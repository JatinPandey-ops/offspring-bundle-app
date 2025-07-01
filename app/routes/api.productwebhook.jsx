import { json } from "@remix-run/node";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const topic = request.headers.get("x-shopify-topic");
  
  if (!topic) {
    return json({ error: "Missing webhook topic" }, { status: 400 });
  }

  try {
    const payload = await request.json();

    switch (topic) {
      case "products/create": {
        await prisma.product.create({
          data: {
            id: String(payload.id),
            title: payload.title,
            handle: payload.handle,
            descriptionHtml: payload.body_html || null,
            productType: payload.product_type || null,
            vendor: payload.vendor || null,
            tags: payload.tags || null,
            variants: {
              create: payload.variants.map((variant) => {
                // Transform REST API option format to array format matching GraphQL implementation
                const selectedOptions = [];
                
                // Shopify REST API webhook data includes product options array
                if (payload.options && payload.options.length > 0) {
                  // For each option defined in the product
                  payload.options.forEach((option, index) => {
                    // Get the corresponding option value from the variant (option1, option2, option3)
                    const optionValue = variant[`option${index + 1}`];
                    
                    // Only add if the option value exists
                    if (optionValue) {
                      selectedOptions.push({
                        name: option.name,
                        value: optionValue
                      });
                    }
                  });
                }
                
                return {
                  id: String(variant.id),
                  title: variant.title,
                  price: parseFloat(variant.price),
                  sku: variant.sku || null,
                  inventoryQuantity: variant.inventory_quantity || null,
                  selectedOptions, // Array of {name, value} objects matching GraphQL format
                  barcode: variant.barcode || null,
                  weight: variant.weight || null,
                  weightUnit: variant.weight_unit || null
                };
              })
            },
            images: {
              create: payload.images.map((image) => ({
                shopifyImageId: String(image.id),
                src: image.src,
                altText: image.alt || null
              }))
            }
          }
        });
        return json({ message: "Product created successfully" });
      }

      case "products/update": {
        await prisma.$transaction(async (tx) => {
          // Update product
          await tx.product.update({
            where: { id: String(payload.id) },
            data: {
              title: payload.title,
              handle: payload.handle,
              descriptionHtml: payload.body_html || null,
              productType: payload.product_type || null,
              vendor: payload.vendor || null,
              tags: payload.tags || null
            }
          });

          // Handle variants - delete old ones and create new ones
          await tx.variant.deleteMany({
            where: { productId: String(payload.id) }
          });

          if (payload.variants && payload.variants.length > 0) {
            await tx.variant.createMany({
              data: payload.variants.map((variant) => {
                // Transform REST API option format to array format matching GraphQL implementation
                const selectedOptions = [];
                
                // Shopify REST API webhook data includes product options array
                if (payload.options && payload.options.length > 0) {
                  // For each option defined in the product
                  payload.options.forEach((option, index) => {
                    // Get the corresponding option value from the variant (option1, option2, option3)
                    const optionValue = variant[`option${index + 1}`];
                    
                    // Only add if the option value exists
                    if (optionValue) {
                      selectedOptions.push({
                        name: option.name,
                        value: optionValue
                      });
                    }
                  });
                }
                
                return {
                  id: String(variant.id),
                  productId: String(payload.id),
                  title: variant.title,
                  price: parseFloat(variant.price),
                  sku: variant.sku || null,
                  inventoryQuantity: variant.inventory_quantity || null,
                  selectedOptions, // Array of {name, value} objects matching GraphQL format
                  barcode: variant.barcode || null,
                  weight: variant.weight || null,
                  weightUnit: variant.weight_unit || null
                };
              })
            });
          }

          // Handle images - delete old ones and create new ones
          await tx.image.deleteMany({
            where: { productId: String(payload.id) }
          });

          if (payload.images && payload.images.length > 0) {
            await tx.image.createMany({
              data: payload.images.map((image) => ({
                shopifyImageId: String(image.id),
                src: image.src,
                altText: image.alt || null,
                productId: String(payload.id)
              }))
            });
          }
        });

        return json({ message: "Product updated successfully" });
      }

      case "products/delete": {
        await prisma.product.delete({
          where: { id: String(payload.id) }
        });
        return json({ message: "Product deleted successfully" });
      }

      default:
        return json({ error: "Unhandled webhook topic" }, { status: 400 });
    }
    
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ 
      error: "Internal server error", 
      details: error.message 
    }, { status: 500 });
  }
};