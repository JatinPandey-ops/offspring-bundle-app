import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Button,
  Text,
  BlockStack,
  Modal,
  List,
  TextField,
  RadioButton,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Loader function to fetch all products and their variants
export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    // Shopify GraphQL query to fetch products and their variants
    const graphqlQuery = `
      query GetAllProducts {
        products(first: 250) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              productType
              vendor
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
              images(first: 10) {
                edges {
                  node {
                    id
                    src
                    altText
                  }
                }
              }
              featuredImage {
                url
                altText
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(graphqlQuery);
    const productData = (await response.json()).data.products.edges;

    // Process each product and update in the Prisma database
    for (const edge of productData) {
      const productNode = edge.node;
      const shopifyProductId = BigInt(
        productNode.id.replace("gid://shopify/Product/", ""),
      ).toString();

      const variantData = productNode.variants.edges.map((variantEdge) => {
        const variantNode = variantEdge.node;
        return {
          id: BigInt(
            variantNode.id.replace("gid://shopify/ProductVariant/", ""),
          ).toString(),
          title: variantNode.title,
          price: parseFloat(variantNode.price),
          sku: variantNode.sku,
          inventoryQuantity: variantNode.inventoryQuantity ?? 0,
          selectedOptions: variantNode.selectedOptions,
        };
      });

      // Save or update the product and its variants in the database
      await prisma.product.upsert({
        where: { id: shopifyProductId },
        update: {
          title: productNode.title,
          handle: productNode.handle,
          descriptionHtml: productNode.descriptionHtml ?? "",
          productType: productNode.productType ?? "",
          vendor: productNode.vendor ?? "",
          variants: {
            deleteMany: {}, // Delete existing variants
            create: variantData, // Re-create variants
          },
        },
        create: {
          id: shopifyProductId,
          title: productNode.title,
          handle: productNode.handle,
          descriptionHtml: productNode.descriptionHtml ?? "",
          productType: productNode.productType ?? "",
          vendor: productNode.vendor ?? "",
          variants: {
            create: variantData, // Create variants
          },
        },
      });
    }

    return json({ products: productData });
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ error: "Failed to load products" }, { status: 500 });
  }
};

// Action to handle form submission and save the bundle
export const action = async ({ request }) => {
  console.log("Action function started");

  const formData = await request.formData();
  const selectedVariants = JSON.parse(formData.get("selectedVariants")); // Array of selected variants with quantities
  const placeholderProductId = formData
    .get("placeholderProductId")
    .replace("gid://shopify/Product/", "");
  const maxSelections = null;
  const singleDesignSelection = false;
  const wipesQuantity = formData.get("wipesQuantity")
    ? parseInt(formData.get("wipesQuantity"), 10)
    : null; // Allow null for wipes quantity
  let wipeProductId = formData.get("wipeProductId")
    ? formData.get("wipeProductId").replace("gid://shopify/Product/", "")
    : null; // Allow null for wipe product ID
  console.log(formData);
  console.log("Selected Variants:", selectedVariants);
  console.log("Placeholder Product ID:", placeholderProductId);
  console.log("Wipe Product ID:", wipeProductId);

  try {
    // Check if wipeProductId exists in the Product table
    if (wipeProductId) {
      console.log("Checking wipe product...");
      const wipeProduct = await prisma.product.findUnique({
        where: { id: wipeProductId },
      });

      if (!wipeProduct) {
        console.log(
          `Wipe product with ID ${wipeProductId} does not exist, setting wipeProductId to null.`,
        );
        wipeProductId = null; // Set to null if the wipe product does not exist
      }
    }

    // Fetch the placeholder product's title and variants
    console.log("Fetching placeholder product from Prisma...");
    const placeholderProduct = await prisma.product.findUnique({
      where: { id: placeholderProductId },
      include: { variants: true }, // Include variants to fetch price
    });

    if (!placeholderProduct) {
      throw new Error("Selected placeholder product not found");
    }

    console.log("Placeholder Product fetched:", placeholderProduct);

    // Prepare the data object for creating the bundle
    const bundleData = {
      id: placeholderProductId,
      userChosenName: placeholderProduct.title,
      price: parseFloat(placeholderProduct.variants[0].price), // Using the first variant's price
      maxSelections, // Save max selections in the bundle
      singleDesignSelection, // Save the single design selection boolean in the bundle
      wipesQuantity, // Save wipes quantity in the bundle
      wipeProductId, // Set wipeProductId, either as the valid ID or null
      selectedVariantsData: selectedVariants, // Store the selected variants array
      bundleVariants: {
        create: selectedVariants.map((variant) => ({
          variant: {
            connect: {
              id: variant.id.replace("gid://shopify/ProductVariant/", ""),
            },
          }, // Connect existing variant
        })),
      },
    };

    console.log("Creating a new bundle in Prisma...");
    const newBundle = await prisma.bundle.create({
      data: bundleData,
      include: {
        bundleVariants: true, // Include the associated variants in the response
      },
    });

    console.log("New bundle created:", newBundle);
    return json({ success: true, bundle: newBundle });
  } catch (error) {
    console.error("Error creating bundle:", error);
    return json({ success: false, error: error.message });
  }
};

// Component that displays products and allows selection of variants
export default function BundleForm() {
  const actionData = useActionData(); // To get action response from server
  const { products: initialProducts } = useLoaderData();
  const [products, setProducts] = useState(initialProducts);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] =
    useState(null);
  const [placeholderProductSelection, setPlaceholderProductSelection] =
    useState(null);
  const [isPlaceholderModalOpen, setIsPlaceholderModalOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false); // State for wipe product modal
  const [maxSelections, setMaxSelections] = useState(5);
  const [singleDesignSelection, setSingleDesignSelection] = useState(false);
  const [wipeProductSelection, setWipeProductSelection] = useState(null); // New state for wipe product selection
  const [wipesQuantity, setWipesQuantity] = useState(0); // New state for wipes quantity
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [searchTerm, setSearchTerm] = useState(""); // State to hold the search term

  const submit = useSubmit();

  useEffect(() => {
    if (actionData?.success) {
      // Show success toast
      showToast("Bundle created successfully!");
      resetFormState(); // Reset form after success
    }

    if (actionData?.error) {
      // Show error toast
      showToast(actionData.error);
    }
  }, [actionData]);
  // Open modal to show product variants
  const openVariantModal = (product) => {
    setSelectedProductForVariants(product);
    setIsVariantModalOpen(true);
  };

  // Select variant and add to selectedVariants list
  const selectVariant = (variant) => {
    const selectedVariant = {
      ...variant,
      quantity: 1, // Default quantity
    };
    setSelectedVariants((prev) => [...prev, selectedVariant]);
  };

  // Handle selection of the radio button
  const handleRadioChange = (variant) => {
    setSelectedVariantId(variant.id); // Update the selected variant
    selectVariant(variant); // Call the variant selection handler
  };
  // Update quantity for a selected variant
  const updateVariantQuantity = (variantId, quantity) => {
    setSelectedVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId ? { ...variant, quantity } : variant,
      ),
    );
  };

  // Remove variant from the selectedVariants list
  const removeVariant = (variantId) => {
    setSelectedVariants((prev) => prev.filter((v) => v.id !== variantId));
  };

  // Submit the bundle data to the server
  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("selectedVariants", JSON.stringify(selectedVariants));
    formData.append("placeholderProductId", placeholderProductSelection);
    formData.append("wipeProductId", wipeProductSelection);
    formData.append("wipesQuantity", wipesQuantity);
    formData.append("maxSelections", maxSelections);
    formData.append("singleDesignSelection", singleDesignSelection);

    submit(formData, { method: "post" });
  }, [
    selectedVariants,
    placeholderProductSelection,
    wipeProductSelection,
    wipesQuantity,
    maxSelections,
    singleDesignSelection,
    submit,
  ]);

  const handleSearchChange = (value) => setSearchTerm(value.toLowerCase());
  const filteredVariants = selectedProductForVariants?.variants.edges.filter(
    (variantEdge) => variantEdge.node.title.toLowerCase().includes(searchTerm),
  );
  const filteredProducts = products.filter((item) =>
    item.node.title.toLowerCase().includes(searchTerm),
  );

  // Function to get product details by ID
function getProductDetailsById(productId) {
  // Find the product by matching the id
  const product = products.find(
    (product) => product.node.id === productId
  );

  // If the product is found, return its details
  if (product) {
    return {
      id: product.node.id,
      title: product.node.title,
      featuredImage: product.node.featuredImage?.url || "",
      price: product.node.variants.edges[0]?.node.price || "N/A" // assuming price is in the first variant
    };
  }

  // If product is not found, return null
  return null;
}

const showToast = (message) => {
  shopify.toast.show(message,  {
    duration: 5000,
  });
};

const resetFormState = () => {
  setSelectedVariants([]);
  setPlaceholderProductSelection(null);
  setWipeProductSelection(null);
  setWipesQuantity(0);
};
  return (
    <Page title="Create Bundle">
      <Layout>
        <Layout.Section>
          <TextField
            label="Search Products"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by product name"
            autoComplete="off"
          />
          {/* Products List */}
          <Card>
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={filteredProducts}
              renderItem={(item) => {
                const { id, title, featuredImage } = item.node;
                const media = (
                  <Thumbnail
                    source={featuredImage?.url || ""}
                    alt={featuredImage?.altText || title}
                  />
                );
                return (
                  <ResourceItem
                    id={id}
                    media={media}
                    accessibilityLabel={`Select variants for ${title}`}
                  >
                    <Text variant="bodyMd">{title}</Text>
                    <Button
                      variant="primary"
                      onClick={() => openVariantModal(item.node)}
                    >
                      Select Variants
                    </Button>
                  </ResourceItem>
                );
              }}
            />
          </Card>
        </Layout.Section>

        {/* Selected Variants Side Pane */}
        {selectedVariants.length > 0 && (
  <Layout.Section variant="oneThird">
    <Card title="Selected Variants">
      <BlockStack inlineAlign="stretch">
        {selectedVariants.map((variant) => (
          <Card key={variant.id} title={`${selectedProductForVariants.title} - ${variant.title}`} sectioned>
            <BlockStack align="space-between">
              <Text as="p" variant="bodyMd" color="subdued">
              {selectedProductForVariants.title} - {variant.title}
              </Text>
              <TextField
                type="number"
                label="Quantity"
                value={variant.quantity}
                onChange={(value) =>
                  updateVariantQuantity(variant.id, parseInt(value))
                }
              />
              <Button
                variant="plain"
                onClick={() => removeVariant(variant.id)}
              >
                Remove
              </Button>
            </BlockStack>
          </Card>
        ))}

        <Button
          variant="primary"
          onClick={() => setIsPlaceholderModalOpen(true)}
        >
          Select Placeholder Product
        </Button>

        {placeholderProductSelection && (
          <Card title="Selected Placeholder Product" sectioned>
            <BlockStack>
              <Thumbnail
                source={getProductDetailsById(placeholderProductSelection).featuredImage}
                alt={getProductDetailsById(placeholderProductSelection).title}
              />
              <Text as="p" variant="bodyMd" color="subdued">
                {getProductDetailsById(placeholderProductSelection).title}
              </Text>
            </BlockStack>
          </Card>
        )}

        <Button
          variant="primary"
          onClick={() => setIsWipeModalOpen(true)}
        >
          Select Wipe Product
        </Button>

        {wipeProductSelection && (
          <Card title="Selected Wipe Product" sectioned>
            <BlockStack>
              <Thumbnail
                source={getProductDetailsById(wipeProductSelection ).featuredImage}
                alt={getProductDetailsById(wipeProductSelection ).title}
              />
              <Text as="p" variant="bodyMd" color="subdued">
                {getProductDetailsById(wipeProductSelection).title}
              </Text>
            </BlockStack>
          </Card>
        )}

        <TextField
          type="number"
          label="Quantity of Wipes"
          value={wipesQuantity}
          onChange={(value) => setWipesQuantity(parseInt(value))}
          min={0}
        />

        <Button variant="primary" tone="success" onClick={handleSubmit}>
          Save Bundle
        </Button>
      </BlockStack>
    </Card>
  </Layout.Section>
)}

      </Layout>

      {/* Modal for Variant Selection */}
      <Modal
        open={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        title={`Select Variants for ${selectedProductForVariants?.title}`}
        primaryAction={{
          content: "Close",
          onAction: () => setIsVariantModalOpen(false),
        }}
      >
        <Modal.Section>
          <div>
            {/* Search box to filter variants */}
            <TextField
              label="Search Variants"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by variant name"
              autoComplete="off"
            />

            {/* List of filtered variants */}
            <List>
              {filteredVariants?.map((variantEdge) => {
                const variant = variantEdge.node;

                return (
                  <List.Item key={variant.id}>
                    <BlockStack inlineAlign="start">
                      {/* Radio Button with variant and product name as label */}
                      <RadioButton
                        label={`${selectedProductForVariants.title} - ${variant.title}`}
                        checked={selectedVariants.some(
                          (selectedVariant) =>
                            selectedVariant.id === variant.id,
                        )} // Check if this variant is selected
                        onChange={() => handleRadioChange(variant)} // Handle radio selection
                      />
                    </BlockStack>
                  </List.Item>
                );
              })}
            </List>
          </div>
        </Modal.Section>
      </Modal>

      {/* Modal for Placeholder Product Selection */}
      <Modal
        open={isPlaceholderModalOpen}
        onClose={() => setIsPlaceholderModalOpen(false)}
        title="Select Placeholder Product"
        primaryAction={null} // Remove default primary action
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setIsPlaceholderModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <ResourceList
            resourceName={{ singular: "product", plural: "products" }}
            items={products.filter((product) =>
              product.node.title.toLowerCase().includes("bundle"),
            )}
            renderItem={(item) => {
              const { id, title, featuredImage } = item.node;
              const media = (
                <Thumbnail
                  source={featuredImage?.url || ""}
                  alt={featuredImage?.altText || title}
                />
              );
              return (
                <ResourceItem
                  id={id}
                  media={media}
                  accessibilityLabel={`Select ${title} as placeholder product`}
                >
                  <Text variant="bodyMd">{title}</Text>

                  {/* Button to select the placeholder product */}
                  <Button
                    variant={
                      placeholderProductSelection === id ? "success" : "primary"
                    }
                    onClick={() => {
                      setPlaceholderProductSelection(id); // Set the selected product
                      setIsPlaceholderModalOpen(false); // Close modal after selection
                    }}
                  >
                    {placeholderProductSelection === id ? "Selected" : "Select"}
                  </Button>
                </ResourceItem>
              );
            }}
          />
        </Modal.Section>
      </Modal>

      {/* Modal for Wipe Product Selection */}
      <Modal
        open={isWipeModalOpen}
        onClose={() => setIsWipeModalOpen(false)}
        title="Select Wipe Product"
        primaryAction={null} // Remove default primary action since selection happens via buttons
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setIsWipeModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <ResourceList
            resourceName={{ singular: "product", plural: "products" }}
            items={products.filter((product) =>
              product.node.title.toLowerCase().includes("wipes"),
            )}
            renderItem={(item) => {
              const { id, title, featuredImage } = item.node;
              const media = (
                <Thumbnail
                  source={featuredImage?.url || ""}
                  alt={featuredImage?.altText || title}
                />
              );
              return (
                <ResourceItem
                  id={id}
                  media={media}
                  accessibilityLabel={`Select ${title} as wipe product`}
                >
                  <Text variant="bodyMd">{title}</Text>

                  {/* Button to select the wipe product */}
                  <Button
                    variant={
                      wipeProductSelection === id ? "success" : "primary"
                    }
                    onClick={() => {
                      setWipeProductSelection(id); // Set the selected product
                      setIsWipeModalOpen(false); // Close the modal after selection
                    }}
                  >
                    {wipeProductSelection === id ? "Selected" : "Select"}
                  </Button>
                </ResourceItem>
              );
            }}
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
