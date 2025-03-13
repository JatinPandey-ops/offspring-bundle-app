// @ts-check
/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  console.log("CART TRANSFORMER WITH FIXED BUNDLE PRICE RUNNING");
  
  // Process cart lines
  for (const line of input.cart.lines) {
    // Check if this is a bundle parent
    const parentAttr = line.parentAttr;
    if (!parentAttr || parentAttr.value !== 'true') {
      continue;
    }
    
    // Get bundle ID for logging
    const bundleId = line.bundleIdAttr?.value || 'unknown';
    console.log(`Found bundle with ID: ${bundleId}`);
    
    // Get component variant IDs
    const componentsAttr = line.componentsAttr;
    if (!componentsAttr || !componentsAttr.value) {
      console.log(`No components found for bundle ${bundleId}`);
      continue;
    }
    
    try {
      // Parse component IDs from JSON string
      const componentIds = JSON.parse(componentsAttr.value);
      console.log(`Found ${componentIds.length} components for bundle ${bundleId}`);
      
      const wipeProductAttr = line.wipeProductAttr;
      const wipesQuantityAttr = line.wipesQuantityAttr;
      
      let wipeProductId = null;
      let wipeProductQuantity = 0;
      
      if (wipeProductAttr && wipeProductAttr.value) {
        wipeProductId = wipeProductAttr.value;
        wipeProductQuantity = wipesQuantityAttr && wipesQuantityAttr.value ? 
          parseInt(wipesQuantityAttr.value, 10) : 1;
        
        console.log(`Found wipe product ID: ${wipeProductId}, quantity: ${wipeProductQuantity}`);
      }
      
      // Get bundle title - simple fix
      let bundleTitle = "";
      if (line.bundleTitleAttr?.value) {
        bundleTitle = line.bundleTitleAttr.value.split('\n')[0].trim();
      } else {
        // Fallback to merchandise title if bundleTitleAttr is not available
        bundleTitle = line.merchandise.__typename === "ProductVariant" ? 
          line.merchandise.product.title : line.merchandise.title;
      }
      
      console.log(`Using bundle title: ${bundleTitle}`);
      
      // Get the bundle price from cart data
      const bundlePrice = parseFloat(line.cost?.totalAmount?.amount || "0");
      console.log(`Bundle price: ${bundlePrice}`);
      
      // Get the optional component prices if they were passed from the frontend
      const componentPricesAttr = line.componentPricesAttr;
      let componentPrices = [];
      
      if (componentPricesAttr && componentPricesAttr.value) {
        try {
          componentPrices = JSON.parse(componentPricesAttr.value);
          console.log(`Component prices provided: ${JSON.stringify(componentPrices)}`);
        } catch (e) {
          console.error(`Error parsing component prices: ${e}`);
        }
      }
      
      // Create expandedCartItems array for regular components
      const expandedItems = componentIds.map((id, index) => {
        // Add gid prefix if not already present
        const fullId = id.includes('gid://') ? id : `gid://shopify/ProductVariant/${id}`;
        
        // Use the provided price if available, otherwise set to 0
        const itemPrice = componentPrices[index] || "0";
        
        return {
          merchandiseId: fullId,
          quantity: 1,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: itemPrice
              }
            }
          }
        };
      });
      
      // Add wipe product if available with price 0
      if (wipeProductId && wipeProductQuantity > 0) {
        // If the ID doesn't have the gid:// prefix, add it
        const fullWipeId = wipeProductId.includes('gid://') ? 
          wipeProductId : `gid://shopify/ProductVariant/${wipeProductId}`;
          
        console.log(`Adding wipe product variant: ${fullWipeId}, quantity: ${wipeProductQuantity}`);
        
        expandedItems.push({
          merchandiseId: fullWipeId,
          quantity: wipeProductQuantity,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: "0" // Set wipe product price to 0
              }
            }
          }
        });
      }
      
      // Return the properly formatted operation
      return {
        operations: [
          {
            expand: {
              cartLineId: line.id,
              title: bundleTitle,
              image: null,
              expandedCartItems: expandedItems
            }
          }
        ]
      };
    } catch (error) {
      console.error(`Error processing bundle ${bundleId}:`, error);
    }
  }
  
  return NO_CHANGES;
}