// Variable Declarations
  let selectedVariants = [];
  let selectedVariantsData = [];
  let maxSelections = 0;
  let singleDesignSelection = false;
  let wipeProductId = null;
  let wipeQuantity = 0;
  let wipeProductName = null; 
  let bundleData = null;
  let sectionId = `{{ section.id }}`;
  let variantCounter = 0; 
  const sizeOrder = ['NB26', 'NB56', 'S', 'M', 'L', 'XL', 'XXL'];
  
  // Fetch bundle data from API
  document.addEventListener('DOMContentLoaded', function () {
    const bundleVariantSelector = document.getElementById('bundle-variant-selector');
    if (!bundleVariantSelector) {
      console.error("Bundle variant selector not found.");
      return;
    }
    const placeholderProductId = bundleVariantSelector.getAttribute('data-placeholder-id');
    console.log(placeholderProductId);
    fetch(`https://gauge-decrease-having-wb.trycloudflare.com/api/bundle?placeholderProductId=${placeholderProductId}`)
      .then(response => response.json())
      .then(data => {
        bundleData = data
        console.log(bundleData)
        if (!bundleData || !bundleData.bundle) {
          console.error("Invalid bundle data received.");
          return;
        }

        maxSelections = bundleData.bundle.maxSelections;
        singleDesignSelection = bundleData.bundle.singleDesignSelection;
        wipeProductId = bundleData.bundle.wipeProductId;
        wipeQuantity = bundleData.bundle.wipesQuantity;
        wipeProductName = bundleData.bundle.wipeProduct ? bundleData.bundle.wipeProduct.title : ''; // Added this line

        // Check if bundleProducts is available
        if (bundleData.bundle.bundleProducts && bundleData.bundle.bundleProducts.length > 0) {
          const data = bundleData.bundle.bundleProducts;
          // Handle the selection logic based on whether singleDesignSelection is true or false
          if (singleDesignSelection) {
            processSingleDesignBundle(data);
          } else {
            processMultiDesignBundle(data);
          }
        } else {
          // bundleProducts is unavailable, process selectedVariantsData
          processSelectedVariantsData(bundleData.bundle.selectedVariantsData, bundleData);
        }
      })
      .catch(error => console.error('Error fetching bundle data:', error));
  });

  // Process selectedVariantsData when bundleProducts is unavailable
  function processSelectedVariantsData(variantsData, bundleData) {
    console.log("Processing selected variants data");
    if (!variantsData || variantsData.length === 0) {
      alert('No variants available to add to the cart.');
      return;
    }

    // Store selectedVariantsData for later use
    selectedVariantsData = variantsData;
    console.log(selectedVariantsData);

    // Build the selectedVariants array
    selectedVariants = variantsData.map(variant => {
      const sizeOption = variant.selectedOptions.find(opt => opt.name === 'Size');
      const designOption = variant.selectedOptions.find(opt => opt.name === 'Design' || opt.name === 'Type');
      return {
        id: variant.id,
        quantity: variant.quantity,
        title: variant.title,
        size: sizeOption ? sizeOption.value : '',
        design: designOption ? designOption.value : ''
      };
    });

    // Update hidden inputs
    updateHiddenInputsForSelectedVariantsData(bundleData);
  }

  
  function updateHiddenInputsForSelectedVariantsData(bundleData) {
  console.log("Updating hidden inputs");
  const hiddenInput = document.getElementById('all-selected-variants');
  const readableInput = document.getElementById('readable-variants');
  const wipeProductHiddenInput = document.getElementById('wipe-product-id');
  
  if (!hiddenInput || !readableInput || !wipeProductHiddenInput) return;
  
  const variantIds = [];
  const readableVariants = [];
  
  // Add selected variants
selectedVariants.forEach(variant => {
  // Find the SKU for this variant from bundleData
  let sku = '';
  if (bundleData?.bundle?.bundleProducts) {
    bundleData.bundle.bundleProducts.forEach(bundleProduct => {
      bundleProduct.product.variants.forEach(productVariant => {
        if (productVariant.id === variant.id) {
          sku = productVariant.sku;
        }
      });
    });
  }

  items.push({
    id: variant.id,
    quantity: 1,
    properties: {
      sku: sku
    }
  });
});

  
  hiddenInput.value = JSON.stringify(variantIds);
  readableInput.value = readableVariants.join('\n');
  
  // Handle the wipe product
  if (bundleData && bundleData.bundle && bundleData.bundle.wipeProduct) {
    const wipeProductTitle = bundleData.bundle.wipeProduct.title;
    const wipesQuantity = bundleData.bundle.wipesQuantity || 1;
    const wipeVariantId = bundleData.bundle.wipeProductId;
  
    // Add the wipe product to variantIds
    variantIds.push({
      id: wipeVariantId,
      quantity: wipesQuantity
    });
  
    // Include in readable variants
    readableVariants.push(`${wipesQuantity} x ${wipeProductTitle}`);
  
    // Update hidden inputs
    wipeProductHiddenInput.value = wipeProductTitle;
    hiddenInput.value = JSON.stringify(variantIds);
    readableInput.value = readableVariants.join('\n');
  } else {
    // If no wipe product, clear the hidden input
    wipeProductHiddenInput.value = '';
  }
  }
  // Update hidden inputs for selectedVariantsData


 // Form submission handling
(function() {
    const form = document.getElementById(`product-form-${sectionId}`);
    if (form) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault(); // Prevent default form submission
            await handleFormSubmission();
        });
    }
})();

// Add the handleFormSubmission function
async function handleFormSubmission() {
  if (selectedVariants.length < maxSelections) {
    alert(`Please select exactly ${maxSelections} items before proceeding.`);
    return;
  }

  try {
    // Clear the cart first
    await fetch('/cart/clear.js', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    // Generate a unique bundle ID
    const bundleId = `bundle_${Date.now()}`; 
    const placeholderProductId = document.getElementById('variant-id').value;
    
    // Get bundle title from product page
    const bundleTitle = document.querySelector('.product__title')?.textContent.trim() || 
                      "Bundle";
    
    // Create array of variant IDs
    const componentIds = selectedVariants.map(variant => variant.id);
    
    // Store as a proper JSON string
    const componentsJson = JSON.stringify(componentIds);
    
    // If you want to set specific prices for each component, create an array
    // This could come from your bundle data or be calculated based on your business logic
    const bundlePrice = parseFloat(document.getElementById('product-price').textContent.replace(/[^0-9.]/g, ''));
    const componentCount = componentIds.length;
    const pricePerComponent = componentCount > 0 ? (bundlePrice / componentCount).toFixed(2) : "0";
    
    // Create an array of prices (could be equal distribution or custom prices)
    const componentPrices = componentIds.map(() => pricePerComponent);
    
    // Store as a proper JSON string
    const componentPricesJson = JSON.stringify(componentPrices);
    
    // Create properties object with component info
    const properties = {
      '_bundle_id': bundleId,
      '_bundle_parent': 'true',
      '_expand_components': componentsJson,
      '_bundle_title': bundleTitle,
      '_component_prices': componentPricesJson // Add the component prices
    };
    
    // If wipe product is available
    if (bundleData?.bundle?.wipesQuantity > 0 && bundleData?.bundle?.wipeVariantId) {
      // Get the variant ID
      const variantId = bundleData.bundle.wipeVariantId;
      
      // Add the proper Shopify variant ID format
      const fullVariantId = variantId.includes('gid://') 
        ? variantId 
        : `gid://shopify/ProductVariant/${variantId}`;
      
      properties['_wipe_product_id'] = fullVariantId;
      properties['_wipes_quantity'] = bundleData.bundle.wipesQuantity.toString();
      
      console.log(`Adding wipe product variant ID: ${fullVariantId}, quantity: ${bundleData.bundle.wipesQuantity}`);
    }
    
    // Add only the bundle placeholder product with component info
    const items = [{
      id: placeholderProductId,
      quantity: 1,
      properties: properties
    }];

    console.log('Adding bundle to cart:', items);

    // Add to cart
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'Failed to add items to cart');
    }

    // Navigate to cart page after successful addition
    window.location.href = '/cart';
  } catch (error) {
    console.error('Error adding bundle to cart:', error);
    alert('There was an error adding your bundle to the cart. Please try again.');
  }
}

  // For single design bundles (no design selector, just size/type)
  function processSingleDesignBundle(bundleProducts) {
    const allSizesSet = new Set();
    const typeOptions = {};

    const defaultDesignImages = {
      "Comfort Tapes": "https://cdn.shopify.com/s/files/1/0883/9053/3415/files/comfort-tapes.png",
      "Comfort Pants": "https://cdn.shopify.com/s/files/1/0883/9053/3415/files/comfort-pants.png"
    };

    bundleProducts.forEach(bundleProduct => {
      bundleProduct.product.variants.forEach(variant => {
        if (!variant.sku || !variant.selectedOptions) return;

        const sizeOption = variant.selectedOptions.find(opt => opt.name === 'Size');
        const typeOption = variant.selectedOptions.find(opt => opt.name === 'Type');
        if (!sizeOption || !typeOption) return;

        const size = sizeOption.value;
        const type = typeOption.value;

        allSizesSet.add(size);

        if (!typeOptions[size]) {
          typeOptions[size] = new Set();
        }
        typeOptions[size].add(type);
      });
    });

    // Convert the Set to an Array and sort it
    let allSizes = Array.from(allSizesSet);
    allSizes.sort((a, b) => {
      return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
    });

    // Generate the size and type HTML with sorted sizes
    singleGenerateSizeTypeHTML(allSizes, typeOptions, defaultDesignImages, bundleProducts);
  }

  // Generate size and type HTML for single design bundles
  function singleGenerateSizeTypeHTML(allSizes, typeOptions, defaultDesignImages, bundleProducts) {
    const bundleVariantSelector = document.getElementById('bundle-variant-selector');
    if (!bundleVariantSelector) {
      console.error("Bundle variant selector not found.");
      return;
    }
  
    let productHtml = `<h4>Step 1. Select Size:</h4><div class="pills" id="size-options">`;
  
    allSizes.forEach(size => {
      productHtml += `
        <label class="pill">
          <input type="radio" name="size" value="${size}" data-size="${size}">
          <span>${size}</span>
        </label>`;
    });
    productHtml += `</div>`;
  
    // Wrap the type heading and options inside a parent container
    productHtml += `
      <div id="type-container" style="display: none;">
        <h4>Step 2. Select Type:</h4>
        <div class="pills" id="type-options"></div>
      </div>`;
  
    // Wrap the design heading and options inside a parent container
    productHtml += `
      <div id="design-container" style="display: none;">
        <h4>Design:</h4>
         <div id="selected-variants-display" class="selected-variants-display"></div>
        <div id="selection-count">0 / ${maxSelections} selected</div>
        <div id="design-options"></div>
      </div>`;
  
    bundleVariantSelector.innerHTML = productHtml;
  
    const sizeOptions = document.querySelectorAll('input[name="size"]');
    if (sizeOptions.length > 0) {
      sizeOptions.forEach(sizeRadio => {
        sizeRadio.addEventListener('click', function () {
          singleUpdateTypeOptions(typeOptions, this.value, defaultDesignImages, bundleProducts);
          updateSelectedClass(this);
        });
      });
    } else {
      console.error("No size options available to attach event listeners.");
    }
  }

// Similarly, update your generateSizeTypeHTML function for multi-design bundles
 function generateSizeTypeHTML(allSizes, typeOptions, bundleProducts, showDesign = false) {
    const bundleVariantSelector = document.getElementById('bundle-variant-selector');
    if (!bundleVariantSelector) {
      console.error("Bundle variant selector not found.");
      return;
    }
  
    let productHtml = `<h4>Step 1. Select Size:</h4><div class="pills" id="size-options">`;
  
    allSizes.forEach(size => {
      productHtml += `
        <label class="pill">
          <input type="radio" name="size" value="${size}" data-size="${size}">
          <span>${size}</span>
        </label>`;
    });
    productHtml += `</div>`;
  
    // Wrap the type heading and options inside a parent container
    productHtml += `
      <div id="type-container" style="display: none;">
        <h4>Step 2. Select Type:</h4>
        <div class="pills" id="type-options"></div>
      </div>`;
  
    // Wrap the design heading and options inside a parent container
    productHtml += `
      <div id="design-container" style="display: none;">
        <h4>Step 3. Select Design:</h4>
          <div id="selected-variants-display" class="selected-variants-display"></div>
         <div id="selection-count">0 / ${maxSelections} selected</div>
        <div class="pills" id="design-options"></div>
      </div>`;
    bundleVariantSelector.innerHTML = productHtml;
  
    // Attach event listeners for size selection
    const sizeOptions = document.querySelectorAll('input[name="size"]');
    if (sizeOptions) {
      sizeOptions.forEach(sizeRadio => {
        sizeRadio.addEventListener('click', function () {
          // Reset and hide design options when size changes
          const designContainer = document.getElementById('design-container');
          if (designContainer) {
            designContainer.style.display = 'none';
          }
  
          updateTypeOptions(bundleProducts, this.value, typeOptions);
          updateSelectedClass(this);
        });
      });
    }
  }
  

  // Update type options for single design bundles
  function singleUpdateTypeOptions(typeOptions, selectedSize, defaultDesignImages, bundleProducts) {
    const typeContainer = document.getElementById('type-options');
    const typeParentContainer = document.getElementById('type-container');
    const designParentContainer = document.getElementById('design-container');
    if (!typeContainer || !typeParentContainer) return;
    typeContainer.innerHTML = '';

    if (typeOptions[selectedSize] && typeOptions[selectedSize].size > 0) {
      typeOptions[selectedSize].forEach(type => {
        typeContainer.innerHTML += `
          <label class="pill">
            <input type="radio" name="type" value="${type}" data-type="${type}">
            <span>${type}</span>
          </label>`;
      });
      typeParentContainer.style.display = 'block';
    } else {
      typeParentContainer.style.display = 'none';
    }

    // Hide the design container when type changes
    if (designParentContainer) {
      designParentContainer.style.display = 'none';
    }

    const typeOptionsElements = document.querySelectorAll('input[name="type"]');
    if (typeOptionsElements.length > 0) {
      typeOptionsElements.forEach(typeRadio => {
        typeRadio.addEventListener('click', function () {
          const selectedType = this.value;
          updateDefaultDesign(selectedSize, selectedType, defaultDesignImages, bundleProducts);
          updateSelectedClass(this);
        });
      });
    } else {
      console.error("No type options available to attach event listeners.");
    }
  }

  // Update default design for single design bundles
  function updateDefaultDesign(selectedSize, selectedType, defaultDesignImages, bundleProducts) {
    const designContainer = document.getElementById('design-options');
    const designParentContainer = document.getElementById('design-container');
    if (!designContainer || !designParentContainer) return;

    // Use the correct default design image for the selected type
    const defaultDesignImage = defaultDesignImages[selectedType] || 'https://cdn.shopify.com/s/files/1/0883/9053/3415/files/default-image.png';

    // Find the variant ID corresponding to the selected size and type
    let variantId = null;
    bundleProducts.forEach(bundleProduct => {
      const product = bundleProduct.product;
      product.variants.forEach(variant => {
        const sizeOption = variant.selectedOptions.find(opt => opt.name === 'Size');
        const typeOption = variant.selectedOptions.find(opt => opt.name === 'Type');
        if (sizeOption && typeOption && sizeOption.value === selectedSize && typeOption.value === selectedType) {
          variantId = variant.id;
        }
      });
    });

    if (!variantId) {
      console.error('Variant ID not found for the selected size and type.');
      return;
    }

    designContainer.innerHTML = `
      <div class="default-design">
        <label class="pill">
          <input type="radio" name="design" value="${variantId}" data-design="${selectedType}">
          <img src="${defaultDesignImage}" alt="${selectedType}" style="width: 100px; height: 100px;">
        </label>
      </div>`;

    designParentContainer.style.display = 'block';

    // Add event listener to handle design selection
    const designRadio = document.querySelector(`input[name="design"]`);
    if (designRadio) {
      designRadio.addEventListener('click', function () {
        const variantId = this.value;
        updateSelectedVariants(variantId, selectedSize, selectedType, this.getAttribute('data-design'));
        updateSelectedClass(this);
      });
    }
  }

  // Update selected class for radio buttons
  function updateSelectedClass(radioButton) {
    const label = radioButton.closest('label');
    if (!label) return;
    document.querySelectorAll(`input[name="${radioButton.name}"]`).forEach(input => {
      const lbl = input.closest('label');
      if (lbl) lbl.classList.remove('selected');
    });
    label.classList.add('selected');
  }

  // For multi-design bundles (designs, sizes, and types)
  function processMultiDesignBundle(bundleProducts) {
    const allSizesSet = new Set();
    const typeOptions = {};

    bundleProducts.forEach(bundleProduct => {
      bundleProduct.product.variants.forEach(variant => {
        if (!variant.sku || !variant.selectedOptions) return;

        const sizeOption = variant.selectedOptions.find(opt => opt.name === 'Size');
        if (!sizeOption) return;

        const size = sizeOption.value;
        allSizesSet.add(size);

        if (!typeOptions[size]) {
          typeOptions[size] = [];
        }

        const fullType = bundleProduct.product.title;
        const typeDisplay = fullType.includes('-') ? fullType.split('-').pop().trim() : fullType;

        // Check for duplicates
        const typeExists = typeOptions[size].some(typeObj => typeObj.fullType === fullType);
        if (!typeExists) {
          typeOptions[size].push({
            fullType: fullType,
            displayType: typeDisplay
          });
        }
      });
    });

    // Convert the Set to an Array and sort it
    let allSizes = Array.from(allSizesSet);
    allSizes.sort((a, b) => {
      return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
    });

    // Generate the size and type HTML with sorted sizes
    generateSizeTypeHTML(allSizes, typeOptions, bundleProducts, true);
  }

  // Generate size and type HTML for multi-design bundles
  function generateSizeTypeHTML(allSizes, typeOptions, bundleProducts, showDesign = false) {
    const bundleVariantSelector = document.getElementById('bundle-variant-selector');
    if (!bundleVariantSelector) {
      console.error("Bundle variant selector not found.");
      return;
    }

    let productHtml = `<h4>Step 1. Select Size:</h4><div class="pills" id="size-options">`;

    allSizes.forEach(size => {
      productHtml += `
        <label class="pill">
          <input type="radio" name="size" value="${size}" data-size="${size}">
          <span>${size}</span>
        </label>`;
    });
    productHtml += `</div>`;

    // Wrap the type heading and options inside a parent container
    productHtml += `
      <div id="type-container" style="display: none;">
        <h4>Step 2. Select Type:</h4>
        <div class="pills" id="type-options"></div>
      </div>`;

    // Wrap the design heading and options inside a parent container
    productHtml += `
      <div id="design-container" style="display: none;">
        <h4>Step 3. Select Design:</h4>
          <div id="selected-variants-display" class="selected-variants-display"></div>
         <div id="selection-count">0 / ${maxSelections} selected</div>
        <div class="pills" id="design-options"></div>
      </div>`;
    bundleVariantSelector.innerHTML = productHtml;

    // Attach event listeners for size selection
    const sizeOptions = document.querySelectorAll('input[name="size"]');
    if (sizeOptions) {
      sizeOptions.forEach(sizeRadio => {
        sizeRadio.addEventListener('click', function () {
          // Reset and hide design options when size changes
          const designContainer = document.getElementById('design-container');
          if (designContainer) {
            designContainer.style.display = 'none';
          }

          updateTypeOptions(bundleProducts, this.value, typeOptions);
          updateSelectedClass(this);
        });
      });
    }
  }

  // Update type options for multi-design bundles
  function updateTypeOptions(bundleProducts, selectedSize, typeOptions) {
    const typeContainer = document.getElementById('type-options');
    const typeParentContainer = document.getElementById('type-container');
    const designParentContainer = document.getElementById('design-container');
    if (!typeContainer || !typeParentContainer) return;
    typeContainer.innerHTML = '';

    if (typeOptions[selectedSize] && typeOptions[selectedSize].length > 0) {
      typeOptions[selectedSize].forEach(typeObj => {
        const typeValue = typeObj.fullType;
        const typeDisplay = typeObj.displayType;

        typeContainer.innerHTML += `
          <label class="pill">
            <input type="radio" name="type" value="${typeValue}" data-type="${typeValue}">
            <span>${typeDisplay}</span>
          </label>`;
      });
      typeParentContainer.style.display = 'block';
    } else {
      typeParentContainer.style.display = 'none';
    }

    // Hide the design container when type changes
    if (designParentContainer) {
      designParentContainer.style.display = 'none';
    }

    // Attach event listeners for type selection
    const typeOptionsElements = document.querySelectorAll('input[name="type"]');
    if (typeOptionsElements.length > 0) {
      typeOptionsElements.forEach(typeRadio => {
        typeRadio.addEventListener('click', function () {
          updateDesignOptions(bundleProducts, selectedSize, this.value);
          updateSelectedClass(this);
        });
      });
    } else {
      console.error("No type options available to attach event listeners.");
    }
  }

  // Update design options for multi-design bundles
  function updateDesignOptions(bundleProducts, selectedSize, selectedType) {
    const designOptionsContainer = document.getElementById('design-options');
    const designParentContainer = document.getElementById('design-container');
    if (!designOptionsContainer || !designParentContainer) return;
    designOptionsContainer.innerHTML = '';

    let hasDesignOptions = false;

    bundleProducts.forEach(bundleProduct => {
      const product = bundleProduct.product;
      if (product.title !== selectedType) return;

      product.variants.forEach(variant => {
  if (!variant.sku || !variant.selectedOptions) return;

  const sizeOption = variant.selectedOptions.find(opt => opt.name === 'Size');
  const designOption = variant.selectedOptions.find(opt => opt.name === 'Design');
  if (!sizeOption || sizeOption.value !== selectedSize) return;

  const design = designOption ? designOption.value : 'default-design';
  const designName = design.replace(/\s+/g, '-').toLowerCase();
  const isSoldOut = variant.inventoryQuantity === 0;

  designOptionsContainer.innerHTML += `
    <label class="pill ${isSoldOut ? 'sold-out' : ''}">
      <input type="radio" name="design" value="${variant.id}" 
        data-design="${designName}" 
        ${isSoldOut ? 'disabled' : ''}>
      <div class="design-image-container ${isSoldOut ? 'sold-out-container' : ''}">
        <img src="https://cdn.shopify.com/s/files/1/0883/9053/3415/files/${designName}.png" 
          alt="${design}" 
          class="${isSoldOut ? 'sold-out-image' : ''}">
        ${isSoldOut ? '<div class="sold-out-overlay"></div>' : ''}
      </div>
    </label>`;

  hasDesignOptions = true;
});
    });

    if (hasDesignOptions) {
      designParentContainer.style.display = 'block';
    } else {
      designParentContainer.style.display = 'none';
    }

    // Attach event listeners for design selection
    const designOptions = document.querySelectorAll('input[name="design"]');
    if (designOptions) {
      designOptions.forEach(designRadio => {
        designRadio.addEventListener('click', function () {
          const variantId = this.value;
          updateSelectedVariants(variantId, selectedSize, selectedType, this.getAttribute('data-design'));
          updateSelectedClass(this);
        });
      });
    }
  }

  // Common functions

  // Update selected variants
  function updateSelectedVariants(variantId, size, type, designName) {
    const totalQuantity = selectedVariants.length;

    if (totalQuantity < maxSelections) {
        // Find the SKU for this variant
        let sku = '';
        if (bundleData?.bundle?.bundleProducts) {
            bundleData.bundle.bundleProducts.forEach(bundleProduct => {
                bundleProduct.product.variants.forEach(productVariant => {
                    if (productVariant.id === variantId) {
                        sku = productVariant.sku;
                    }
                });
            });
        }

        variantCounter++;
        selectedVariants.push({
            id: variantId,
            sku: sku,
            size,
            type,
            design: designName,
            uniqueId: variantCounter
        });

        // Update hidden inputs, render selected variants, update selection count
        updateHiddenInputs();
        renderSelectedVariants();
        updateSelectionCount();
    } else {
        alert(`You can only select up to ${maxSelections} items.`);
    }
}


  // Render selected variants
  function renderSelectedVariants() {
  // Find the container for selected variants
  const selectedVariantsDisplay = document.getElementById('selected-variants-display');
  
  // Check if the container is available
  if (!selectedVariantsDisplay) {
    console.error('No element with ID "selected-variants-display" found.');
    return;
  }

  // Clear the display area first
  selectedVariantsDisplay.innerHTML = `
    <div id="selected-design-parent">
      <div id="variants-container"></div>
    </div>
  `;

      // <img id="img-design-2" src="https://cdn.shopify.com/s/files/1/0883/9053/3415/files/OFS_Flower_Graphic-20.png?v=1727739905"> 
      // <img id="img-design-1" src="https://cdn.shopify.com/s/files/1/0883/9053/3415/files/OFS_Flower_Graphic-21.png?v=1727739906">
  const variantsContainer = document.getElementById('variants-container');
  
  if (!variantsContainer) {
    console.error('No element with ID "variants-container" found.');
    return;
  }

  // Render placeholders for the max selections allowed
  for (let i = 0; i < maxSelections; i++) {
    const variant = selectedVariants[i]; // Get the variant if it exists
    if (variant) {
      // If a design is selected, render the design image
      const design = Array.isArray(variant.design) ? variant.design : [variant.design];
      const variantDesignUrls = design.map(designName => 
        designName.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
      );

      const imageStackHtml = variantDesignUrls.map(variantDesignUrl => `
        <img src="https://cdn.shopify.com/s/files/1/0883/9053/3415/files/${variantDesignUrl}.png" alt="${variantDesignUrl}">
      `).join('');

      // Function to convert a string to title case
function convertToTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize the first letter of each word
    .replace(/-/g, ' '); // Replace hyphens with spaces
}

      // Convert design to title case for tooltip
      const formattedDesign = convertToTitleCase(variant.design);

      // Render the selected variant
      variantsContainer.innerHTML += `
        <div class="selected-variant" data-unique-id="${variant.uniqueId}">
          <div class="image-stack">
            ${imageStackHtml}
            <button type="button" class="remove-variant">×</button>
          </div>
          <span class="tooltip-text">Size: ${variant.size}, Design: ${formattedDesign}</span>
        </div>
      `;
    } else {
      // Render a placeholder if no variant is selected
      variantsContainer.innerHTML += `
        <div class="placeholder-variant">
          <div class="dotted-placeholder">
          <img src="https://cdn.shopify.com/s/files/1/0883/9053/3415/files/ofc-placeholder-diaper-removebg-preview.webp?v=1727828289"/>
          </div>
        </div>
      `;
    }
  }

  // Apply stacking effect after rendering
  applyStackingEffect();

  // Attach event listeners to remove buttons
  document.querySelectorAll('.remove-variant').forEach(button => {
    button.addEventListener('click', function (event) {
      event.preventDefault();
      const parentElement = this.closest('.selected-variant');
      const uniqueId = parseInt(parentElement.getAttribute('data-unique-id'), 10);

      // Find the variant by uniqueId and remove it
      const index = selectedVariants.findIndex(variant => variant.uniqueId === uniqueId);

      if (index !== -1) {
        selectedVariants.splice(index, 1); // Remove the variant
      }

      // Re-render the variants after removal
      renderSelectedVariants();
      updateSelectionCount();
      updateHiddenInputs();
    });
  });

  // Debug: Check if anything was rendered
  if (variantsContainer.innerHTML.trim() === '') {
    console.warn('No variants or placeholders were rendered.');
  }
}


  // Update hidden inputs
  function updateHiddenInputs() {
updateSelectionCount();
  renderSelectedVariants();
}

  // Update selection count
  function updateSelectionCount() {
    const totalQuantity = selectedVariants.length;
    const selectionCountElement = document.getElementById('selection-count');
    if (!selectionCountElement) {
      console.log('selection-count element not found');
      return;
    }
    selectionCountElement.innerText = `${totalQuantity} / ${maxSelections} selected`;
  }

  function applyStackingEffect() {
    const selectedVariants = document.querySelectorAll('.selected-variant, .placeholder-variant');
    const totalVariants = selectedVariants.length;
    
    
    // Updated device configuration with reduced spacing and offsets
    const deviceConfig = {
      mobile: {
        maxWidth: 380,
        stackLimit: 3,
        scale: 1.3,  // Slightly reduced scale
        verticalOffset: 15,
        horizontalPosition: '75%',
        baseImageHeight: 130,
        overlapOffset: 70,  // Reduced from 60
        stackSpacing: 20,
        marginBetweenStacks: 30
      },
      smallTablet: {
        maxWidth: 820,
        stackLimit: 5,
        scale: 1.2,    // Reduced from 1.1
        verticalOffset: 15,
        horizontalPosition: '75%',
        baseImageHeight: 120,
        overlapOffset: 50,  // Reduced from 70
        stackSpacing: 30,   // Reduced from 40
        marginBetweenStacks: 40
      },
      tablet: {
        maxWidth: 1124,
        stackLimit: 5,
        scale: 1.1,  // Reduced from 1.2
        verticalOffset: 20,
        horizontalPosition: '70%',
        baseImageHeight: 120,
        overlapOffset: 55,  // Reduced from 80
        stackSpacing: 40,   // Reduced from 60
        marginBetweenStacks: 50
      },
      desktop: {
        maxWidth: Infinity,
        stackLimit: 5,
        scale: 1.5, 
        verticalOffset: 20,
        horizontalPosition: '75%',
        baseImageHeight: 120,
        overlapOffset: 90,  
        stackSpacing: 40,  
        marginBetweenStacks: 50
      }
    };
  
    // Add container styles
    const styles = `
      .selected-variant,
      .placeholder-variant {
        position: absolute;
        transition: transform 0.3s ease;
        width: ${deviceConfig.mobile.baseImageHeight}px;
        height: auto;
      }
    `;
  
    // Apply styles
    if (!document.getElementById('variant-display-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'variant-display-styles';
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  
    // Determine current device
    const windowWidth = window.innerWidth;
    let currentDevice = deviceConfig.desktop;
    
    if (windowWidth <= deviceConfig.mobile.maxWidth) {
      currentDevice = deviceConfig.mobile;
    } else if (windowWidth <= deviceConfig.smallTablet.maxWidth) {
      currentDevice = deviceConfig.smallTablet;
    } else if (windowWidth <= deviceConfig.tablet.maxWidth) {
      currentDevice = deviceConfig.tablet;
    }
  
    // Calculate layout dimensions with reduced spacing
    const totalStacks = Math.ceil(totalVariants / currentDevice.stackLimit);
    const scaledImageHeight = currentDevice.baseImageHeight * currentDevice.scale;
    const singleStackHeight = scaledImageHeight + 
      (currentDevice.verticalOffset * (Math.min(currentDevice.stackLimit, totalVariants) - 1));
    const totalHeight = (singleStackHeight * totalStacks) +
      (currentDevice.marginBetweenStacks * (totalStacks - 1));
  
    // Apply container heights with reduced padding
    const variantDisplay = document.querySelector('.selected-variants-display');
    const designParent = document.getElementById('selected-design-parent');
    
    if (variantDisplay && designParent) {
      const containerPadding = 20;  // Reduced from 40
      const safetyMargin = 10;      // Reduced from 20
      
      variantDisplay.style.height = `${totalHeight + containerPadding + safetyMargin}px`;
    }
  
    // Position variants with reduced spacing
    selectedVariants.forEach((variant, index) => {
      const stackIndex = Math.floor(index / currentDevice.stackLimit);
      const indexInStack = index % currentDevice.stackLimit;
      
      const yOffset = stackIndex * (singleStackHeight + currentDevice.marginBetweenStacks);
      const xOffset = indexInStack * currentDevice.overlapOffset;
      const stackOffset = indexInStack * currentDevice.verticalOffset;
      
      variant.style.position = 'absolute';
      variant.style.left = currentDevice.horizontalPosition;
      variant.style.transform = `
        translate(-50%, ${yOffset - stackOffset}px) 
        translateX(-${xOffset}px) 
        scale(${currentDevice.scale})
      `;
      variant.style.transformOrigin = 'center bottom';
      variant.style.zIndex = currentDevice.stackLimit - indexInStack;
    });
  }
  
  // Initialize and handle resize
  document.addEventListener('DOMContentLoaded', applyStackingEffect);
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(applyStackingEffect, 250);
  });
  
