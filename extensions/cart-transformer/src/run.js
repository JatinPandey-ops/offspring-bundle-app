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

  for (const line of input.cart.lines) {
    const parentAttr = line.parentAttr;
    if (!parentAttr || parentAttr.value !== 'true') {
      continue;
    }

    const bundleId = line.bundleIdAttr?.value || 'unknown';
    console.log(`Found bundle with ID: ${bundleId}`);

    const componentsAttr = line.componentsAttr;
    if (!componentsAttr || !componentsAttr.value) {
      console.log(`No components found for bundle ${bundleId}`);
      continue;
    }

    try {
      const componentIds = JSON.parse(componentsAttr.value);
      console.log(`Found ${componentIds.length} components for bundle ${bundleId}`);

      const wipeProductAttr = line.wipeProductAttr;
      const wipesQuantityAttr = line.wipesQuantityAttr;

      let wipeProductId = null;
      let wipeProductQuantity = 0;

      if (wipeProductAttr && wipeProductAttr.value) {
        wipeProductId = wipeProductAttr.value;
        wipeProductQuantity = wipesQuantityAttr && wipesQuantityAttr.value
          ? parseInt(wipesQuantityAttr.value, 10)
          : 1;
        console.log(`Found wipe product ID: ${wipeProductId}, quantity: ${wipeProductQuantity}`);
      }

      let bundleTitle = "";
      if (line.bundleTitleAttr?.value) {
        bundleTitle = line.bundleTitleAttr.value.split('\n')[0].trim();
      } else {
        bundleTitle = line.merchandise.__typename === "ProductVariant"
          ? line.merchandise.product.title
          : line.merchandise.title;
      }

      console.log(`Using bundle title: ${bundleTitle}`);

      const bundlePrice = parseFloat(line.cost?.totalAmount?.amount || "0");
      const currencyCode = line.cost?.totalAmount?.currencyCode || "MYR";
      console.log(`Bundle price: ${bundlePrice}`);

      // === NEW fallback logic starts here ===
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

      if (!componentPrices.length) {
        const fallbackPrice = (bundlePrice / componentIds.length).toFixed(2);
        componentPrices = componentIds.map(() => fallbackPrice);
        console.log(`Using fallback price per item: ${fallbackPrice}`);
      }
      // === NEW fallback logic ends here ===

      const expandedItems = componentIds.map((id, index) => {
        const fullId = id.includes('gid://')
          ? id
          : `gid://shopify/ProductVariant/${id}`;
        const itemPrice = componentPrices[index] || "0";

        return {
          merchandiseId: fullId,
          quantity: 1,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: itemPrice,
                currencyCode,
              },
            },
          },
        };
      });

      if (wipeProductId && wipeProductQuantity > 0) {
        const fullWipeId = wipeProductId.includes('gid://')
          ? wipeProductId
          : `gid://shopify/ProductVariant/${wipeProductId}`;

        console.log(`Adding wipe product variant: ${fullWipeId}, quantity: ${wipeProductQuantity}`);

        expandedItems.push({
          merchandiseId: fullWipeId,
          quantity: wipeProductQuantity,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: "0",
                currencyCode,
              },
            },
          },
        });
      }

      return {
        operations: [
          {
            expand: {
              cartLineId: line.id,
              title: bundleTitle,
              image: null,
              expandedCartItems: expandedItems,
            },
          },
        ],
      };
    } catch (error) {
      console.error(`Error processing bundle ${bundleId}:`, error);
    }
  }

  return NO_CHANGES;
}
