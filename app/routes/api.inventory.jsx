import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Use a more specific key structure for deduplication
const processedOrders = new Set();
const PROCESSED_ORDERS_CLEANUP_INTERVAL = 3600000; 

function createOrderKey(orderId, topic) {
    return `${orderId}-${topic}`;
}


setInterval(() => {
    processedOrders.clear();
}, PROCESSED_ORDERS_CLEANUP_INTERVAL);

export async function action({ request }) {
    try {
        const rawBody = await request.text();
        const payload = JSON.parse(rawBody);
        
        const newRequest = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: rawBody,
        });

        const { topic, admin } = await authenticate.webhook(newRequest);
        
        // Early return if not admin
        if (!admin && topic !== "SHOP_REDACT") {
            throw new Response();
        }

        const orderId = payload.id;
        const orderKey = createOrderKey(orderId, topic);

        // Check if this order has already been processed
        if (processedOrders.has(orderKey)) {
            console.log(`Order ${orderId} with topic ${topic} already processed. Skipping.`);
            return json({ message: 'Order already processed' }, { status: 200 });
        }

        // Add to processed set before processing to prevent concurrent executions
        processedOrders.add(orderKey);
        console.log(`Processing order ${orderId} with topic ${topic}`);

        let deltaSign;
        let reason;

        switch (topic) {
            case 'REFUNDS_CREATE':
            case 'ORDERS_CANCELLED':
                deltaSign = 1;
                reason = 'restock';
                break;
            case 'ORDERS_PAID':
                deltaSign = -1;
                reason = 'movement_created';
                break;
            default:
                return json({ message: `Webhook topic ${topic} not handled` }, { status: 200 });
        }

        const lineItems = payload.line_items;
        if (!lineItems?.length) {
            return json({ message: 'No line items found' }, { status: 200 });
        }

        const variantsProperty = lineItems[0].properties?.find(
            prop => prop.name === '_All Selected Variants(ids)'
        );
        
        const wipeProperty = lineItems[0].properties?.find(
            prop => prop.name === '_Wipe Product'
        );

        if (!variantsProperty && !wipeProperty) {
            return json({ message: 'No variants or wipe product found' }, { status: 200 });
        }

        let variants = [];
        if (variantsProperty) {
            try {
                variants = JSON.parse(variantsProperty.value);
            } catch (error) {
                console.error("Error parsing variants:", error);
                processedOrders.delete(orderKey);
                return json({ error: 'Error parsing variants' }, { status: 400 });
            }
        }

        // Add wipe product to variants array if present
        if (wipeProperty) {
            try {
                const wipeProducts = JSON.parse(wipeProperty.value);
                if (Array.isArray(wipeProducts) && wipeProducts.length > 0) {
                    // Get first wipe product (assuming there's only one)
                    const wipeProduct = wipeProducts[0];
                    // Add it to variants array with the gid format
                    variants.push({
                        id: `gid://shopify/Product/${wipeProduct.id}`,
                        quantity: wipeProduct.quantity
                    });
                }
            } catch (error) {
                console.error("Error parsing wipe product:", error);
            }
        }

        // Process all variants in parallel to speed up execution
        const results = await Promise.all(
            variants.map(async (variant) => {
                try {
                    // Determine if this is a wipe product by checking the gid format
                    const isWipeProduct = variant.id.includes('Product/');
                    
                    if (isWipeProduct) {
                        // For wipe product, first get its variant
                        const productQuery = `
                            query getProductVariant($productId: ID!) {
                                product(id: $productId) {
                                    variants(first: 1) {
                                        edges {
                                            node {
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        `;
                        
                        const response = await admin.graphql(productQuery, {
                            variables: { productId: variant.id }
                        });
                        
                        const data = await response.json();
                        const variantId = data.data.product.variants.edges[0].node.id;
                        
                        // Extract numeric ID from the variant gid
                        const numericId = variantId.split('/').pop();
                        
                        const result = await adjustInventoryForVariant(
                            admin,
                            numericId,
                            variant.quantity,
                            deltaSign,
                            reason
                        );
                        return {
                            variantId: variant.id,
                            success: true,
                            result
                        };
                    } else {
                        // For regular variants, process normally
                        const result = await adjustInventoryForVariant(
                            admin,
                            variant.id,
                            variant.quantity,
                            deltaSign,
                            reason
                        );
                        return {
                            variantId: variant.id,
                            success: true,
                            result
                        };
                    }
                } catch (error) {
                    console.error(`Error adjusting inventory for variant ${variant.id}:`, error);
                    return {
                        variantId: variant.id,
                        success: false,
                        error: error.message
                    };
                }
            })
        );

        // If any adjustments failed, consider removing the order from processed set
        if (results.some(result => !result.success)) {
            console.error(`Some variant adjustments failed for order ${orderId}`);
        }

        return json({
            success: true,
            message: `${topic} processed successfully`,
            results,
            orderId
        });

    } catch (error) {
        console.error("Error processing webhook:", error);
        // Remove from processed set if there's an error
        if (payload?.id) {
            const orderKey = createOrderKey(payload.id, topic);
            processedOrders.delete(orderKey);
        }
        return json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

async function adjustInventoryForVariant(adminAuth, variantId, quantityToAdjust, deltaSign, reason) {
    const inventoryItemQuery = `
        query getInventoryItem($variantId: ID!) {
            productVariant(id: $variantId) {
                id
                inventoryItem {
                    id
                    inventoryLevels(first: 1) {
                        edges {
                            node {
                                location {
                                    id
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    const inventoryItemResponse = await adminAuth.graphql(inventoryItemQuery, {
        variables: { variantId: `gid://shopify/ProductVariant/${variantId}` },
    });

    const inventoryData = await inventoryItemResponse.json();
    
    if (!inventoryData.data?.productVariant?.inventoryItem) {
        throw new Error(`No inventory item found for variant ${variantId}`);
    }

    const inventoryItemId = inventoryData.data.productVariant.inventoryItem.id;
    const locationId = inventoryData.data.productVariant.inventoryItem.inventoryLevels.edges[0]?.node.location.id;

    if (!locationId) {
        throw new Error(`No location found for inventory item ${inventoryItemId}`);
    }

    const adjustQuantityMutation = `
        mutation adjustInventoryQuantities($input: InventoryAdjustQuantitiesInput!) {
            inventoryAdjustQuantities(input: $input) {
                userErrors {
                    field
                    message
                }
                inventoryAdjustmentGroup {
                    changes {
                        delta
                        name
                    }
                }
            }
        }
    `;

    const adjustmentInput = {
        input: {
            name: "available",
            reason: reason,
            changes: [{
                delta: deltaSign * quantityToAdjust,
                inventoryItemId: inventoryItemId,
                locationId: locationId
            }]
        }
    };

    const adjustResponse = await adminAuth.graphql(adjustQuantityMutation, {
        variables: adjustmentInput
    });

    const adjustData = await adjustResponse.json();

    if (adjustData.errors || adjustData.data?.inventoryAdjustQuantities?.userErrors?.length > 0) {
        const errors = adjustData.errors || adjustData.data?.inventoryAdjustQuantities?.userErrors;
        throw new Error(`Failed to adjust inventory: ${JSON.stringify(errors)}`);
    }

    return adjustData.data.inventoryAdjustQuantities;
}
