import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Modal,
  Checkbox,
  Divider,
  Banner,
  Box,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Loader function to fetch all products and sync with Prisma
export const loader = async ({ request }) => {
  console.log(request)
  try {
    const { admin } = await authenticate.admin(request);
    console.log(admin)

    console.log("Fetching all products from Shopify...");
    const graphqlQuery = `query GetAllProducts {
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
    }`;

    const response = await admin.graphql(graphqlQuery);
    const productData = (await response.json()).data;
    const products = productData.products.edges;

    console.log("Total products fetched:", products.length);

    // Process each product
    for (const edge of products) {
      const productNode = edge.node;
      const shopifyProductId = BigInt(productNode.id.replace("gid://shopify/Product/", "")).toString(); // Ensure ID is in string format

      console.log(`Processing product: ${productNode.title}`);

      try {
        // Check if the product already exists in the database
        const existingProduct = await prisma.product.findUnique({
          where: { id: shopifyProductId },
        });

        // Process variants and selected options
        const variantData = productNode.variants.edges.map((variantEdge) => {
          const variantNode = variantEdge.node;
          const selectedOptions = variantNode.selectedOptions.map(option => ({
            name: option.name,
            value: option.value,
          }));

          return {
            id: BigInt(variantNode.id.replace("gid://shopify/ProductVariant/", "")).toString(), // Convert to string
            title: variantNode.title,
            price: parseFloat(variantNode.price),
            sku: variantNode.sku,
            inventoryQuantity: variantNode.inventoryQuantity ?? 0, // Default to 0 if null
            selectedOptions, // Store selected options as JSON
          };
        });

        // Process images
        const imageData = productNode.images.edges.map((imageEdge) => ({
          shopifyImageId: BigInt(imageEdge.node.id.replace("gid://shopify/ProductImage/", "")).toString(), // Convert to string
          src: imageEdge.node.src,
          altText: imageEdge.node.altText ?? null, // Default to null if missing
        }));

        if (existingProduct) {
          // Update existing product
          console.log(`Updating existing product: ${productNode.title}`);
          await prisma.product.update({
            where: { id: shopifyProductId },
            data: {
              title: productNode.title,
              handle: productNode.handle,
              descriptionHtml: productNode.descriptionHtml ?? "",
              productType: productNode.productType ?? "",
              vendor: productNode.vendor ?? "",
              variants: {
                deleteMany: {}, // Clear existing variants before updating
                create: variantData, // Re-create all variants
              },
              images: {
                deleteMany: {}, // Clear existing images before updating
                create: imageData, // Re-create all images
              },
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new product
          console.log(`Creating new product: ${productNode.title}`);
          await prisma.product.create({
            data: {
              id: shopifyProductId,
              title: productNode.title,
              handle: productNode.handle,
              descriptionHtml: productNode.descriptionHtml ?? "",
              productType: productNode.productType ?? "",
              vendor: productNode.vendor ?? "",
              variants: {
                create: variantData, // Create variants
              },
              images: {
                create: imageData, // Create images
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
      } catch (error) {
        console.error(`Error processing product with Shopify Product ID ${productNode.title}:`, error.message);
      }
    }

    console.log("Returning all products to the client...");
    return json({
      products,
    });
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ error: "Failed to load products" }, { status: 500 });
  }
};


// Action function to handle form submission and save the bundle
export const action = async ({ request }) => {
  console.log("Action function started");

  const formData = await request.formData();
  const selectedProductIds = JSON.parse(formData.get("selectedProductIds"));
  const placeholderProductId = formData.get("placeholderProductId").replace("gid://shopify/Product/", "");
  const maxSelections = parseInt(formData.get("maxSelections"), 10);
  const singleDesignSelection = formData.get("singleDesignSelection") === "true";
  const singleSizeSelection = formData.get("singleSizeSelection") === "true"; // Add new field
  const wipesQuantity = formData.get("wipesQuantity") ? parseInt(formData.get("wipesQuantity"), 10) : null;
  let wipeProductId = formData.get("wipeProductId") ? formData.get("wipeProductId").replace("gid://shopify/Product/", "") : null;

  console.log("Selected Product IDs:", selectedProductIds);
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
        console.log(`Wipe product with ID ${wipeProductId} does not exist, setting wipeProductId to null.`);
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
      singleSizeSelection,
      wipesQuantity, // Save wipes quantity in the bundle
      wipeProductId, // Set wipeProductId, either as the valid ID or null
      bundleProducts: {
        create: selectedProductIds.map((id) => ({
          product: { connect: { id: id.replace("gid://shopify/Product/", "") } },
        })),
      },
    };

    console.log("Creating a new bundle in Prisma...");
    const newBundle = await prisma.bundle.create({
      data: bundleData,
      include: {
        bundleProducts: true,
      },
    });

    console.log("New bundle created:", newBundle);
    return json({ success: true, bundle: newBundle });
  } catch (error) {
    console.error("Error creating bundle:", error);
    return json({ success: false, error: error.message });
  }
};



// Client code: React component
export default function BundlePage() {
  const actionData = useActionData();
  const { products: initialProducts } = useLoaderData();
  const [products, setProducts] = useState(initialProducts);
  const [searchValue, setSearchValue] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [userChosenName, setUserChosenName] = useState("");
  const [isPlaceholderModalOpen, setIsPlaceholderModalOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [placeholderProductSelection, setPlaceholderProductSelection] = useState(null);
  const [filteredPlaceholderProducts, setFilteredPlaceholderProducts] = useState([]);
  const [maxSelections, setMaxSelections] = useState(5);
  const [singleDesignSelection, setSingleDesignSelection] = useState(false);
  const [singleSizeSelection, setSingleSizeSelection] = useState(false);
  const [wipesQuantity, setWipesQuantity] = useState(0);
  const [wipeProductSelection, setWipeProductSelection] = useState(null);
  const [filteredWipeProducts, setFilteredWipeProducts] = useState([]);
  
  const app = useAppBridge();
  const submit = useSubmit();

  // Function to show Toast messages
  const showToast = (message) => {
    shopify.toast.show(message, {
      duration: 5000,
    });
  };

  const resetFormState = () => {
    setSelectedItems([]);
    setPlaceholderProductSelection(null);
    setWipeProductSelection(null);
    setWipesQuantity(0);
    setMaxSelections(5);
    setSingleDesignSelection(false);
    setSingleSizeSelection(false);
  };

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const filteredProducts = products?.filter((product) =>
    product.node.title.toLowerCase().includes(searchValue.toLowerCase())
  ) || [];

  const handleSelection = (id) => {
    setSelectedItems((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((item) => item !== id)
        : [...prevSelected, id]
    );
  };

  const handleSubmit = useCallback(async () => {
    if (!placeholderProductSelection) {
      showToast("Please select a placeholder product");
      return;
    }

    const formData = new FormData();
    formData.append("selectedProductIds", JSON.stringify(selectedItems));
    formData.append("placeholderProductId", placeholderProductSelection);
    formData.append("maxSelections", maxSelections);
    formData.append("singleDesignSelection", singleDesignSelection);
    formData.append("singleSizeSelection", singleSizeSelection);
    formData.append("wipesQuantity", wipesQuantity);
    formData.append("wipeProductId", wipeProductSelection || "");

    console.log("Submitting bundle creation form...");
    submit(formData, { method: "post" });
  }, [selectedItems, submit, placeholderProductSelection, maxSelections, singleDesignSelection, singleSizeSelection, wipesQuantity, wipeProductSelection]);

  useEffect(() => {
    if (actionData?.success) {
      showToast("Bundle created successfully!");
      resetFormState();
    } else if (actionData?.error) {
      showToast(actionData.error);
    }
  }, [actionData]);

  useEffect(() => {
    if (isPlaceholderModalOpen) {
      const placeholderProducts = products.filter((product) =>
        product.node.title.toLowerCase().includes("bundle")
      );
      setFilteredPlaceholderProducts(placeholderProducts);
    }
  }, [isPlaceholderModalOpen, products]);

  useEffect(() => {
    if (isWipeModalOpen) {
      const wipeProducts = products.filter((product) =>
        product.node.title.toLowerCase().includes("wipes")
      );
      setFilteredWipeProducts(wipeProducts);
    }
  }, [isWipeModalOpen, products]);

  // Function to get selected product details
  const getSelectedProductDetails = (productId) => {
    return products.find((product) => product.node.id === productId)?.node;
  };

  const selectedPlaceholderProduct = placeholderProductSelection 
    ? getSelectedProductDetails(placeholderProductSelection) 
    : null;

  const selectedWipeProduct = wipeProductSelection 
    ? getSelectedProductDetails(wipeProductSelection) 
    : null;

  return (
    <Page>
      <Layout>
        {/* Main Product Selection Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">Product Selection</Text>
              <TextField
                label="Search Products"
                value={searchValue}
                onChange={handleSearchChange}
                autoComplete="off"
                placeholder="Search by product title"
              />
              
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
                      accessibilityLabel={`View details for ${title}`}
                      persistActions
                    >
                      <BlockStack gap="2">
                        <Text variant="bodyMd" fontWeight="bold">{title}</Text>
                        <Button
                          variant={selectedItems.includes(id) ? "secondary" : "primary"}
                          onClick={() => handleSelection(id)}
                        >
                          {selectedItems.includes(id) ? "Selected" : "Select"}
                        </Button>
                      </BlockStack>
                    </ResourceItem>
                  );
                }}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Bundle Configuration Section */}
        {selectedItems.length !== 0 && (
          <Layout.Section variant="oneThird">
            <BlockStack gap="4">
              {/* Selected Products Card */}
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">Selected Products</Text>
                  {selectedItems.map((id) => {
                    const product = getSelectedProductDetails(id);
                    return (
                      <InlineStack key={id} align="space-between" blockAlign="center">
                        <InlineStack gap="4" blockAlign="center">
                          <Thumbnail
                            source={product?.featuredImage?.url || ""}
                            alt={product?.featuredImage?.altText || product?.title}
                          />
                          <Text variant="bodyMd">{product?.title}</Text>
                        </InlineStack>
                        <Button variant="plain" onClick={() => handleSelection(id)}>
                          Remove
                        </Button>
                      </InlineStack>
                    );
                  })}
                </BlockStack>
              </Card>

              {/* Bundle Settings Card */}
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">Bundle Settings</Text>
                  
                  <TextField
                    type="number"
                    label="Max Selections in Bundle"
                    value={maxSelections}
                    onChange={(value) => setMaxSelections(value)}
                    min={1}
                  />

                  <Checkbox
                    label="Allow Single Design Selection?"
                    checked={singleDesignSelection}
                    onChange={(value) => setSingleDesignSelection(value)}
                  />

                  <Checkbox
                    label="Allow Single Size/Type Selection?"
                    checked={singleSizeSelection}
                    onChange={(value) => setSingleSizeSelection(value)}
                  />

                  <TextField
                    type="number"
                    label="Quantity of Wipes"
                    value={wipesQuantity}
                    onChange={(value) => setWipesQuantity(value)}
                    min={0}
                  />
                </BlockStack>
              </Card>

              {/* Placeholder and Wipe Product Selection Card */}
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">Required Products</Text>

                  {/* Placeholder Product Section */}
                  <BlockStack gap="2">
                    <Text variant="headingSm" as="h3">Placeholder Product</Text>
                    {selectedPlaceholderProduct ? (
                      <Banner status="success">
                        <InlineStack gap="4" blockAlign="center">
                          <Thumbnail
                            source={selectedPlaceholderProduct.featuredImage?.url || ""}
                            alt={selectedPlaceholderProduct.title}
                          />
                          <BlockStack gap="1">
                            <Text variant="bodyMd" fontWeight="bold">
                              {selectedPlaceholderProduct.title}
                            </Text>
                            <Button 
                              variant="plain" 
                              onClick={() => setPlaceholderProductSelection(null)}
                            >
                              Change
                            </Button>
                          </BlockStack>
                        </InlineStack>
                      </Banner>
                    ) : (
                      <Button 
                        variant="primary" 
                        onClick={() => setIsPlaceholderModalOpen(true)}
                      >
                        Select Placeholder Product
                      </Button>
                    )}
                  </BlockStack>

                  <Divider />

                  {/* Wipe Product Section */}
                  <BlockStack gap="2">
                    <Text variant="headingSm" as="h3">Wipe Product</Text>
                    {selectedWipeProduct ? (
                      <Banner status="success">
                        <InlineStack gap="4" blockAlign="center">
                          <Thumbnail
                            source={selectedWipeProduct.featuredImage?.url || ""}
                            alt={selectedWipeProduct.title}
                          />
                          <BlockStack gap="1">
                            <Text variant="bodyMd" fontWeight="bold">
                              {selectedWipeProduct.title}
                            </Text>
                            <Button 
                              variant="plain" 
                              onClick={() => setWipeProductSelection(null)}
                            >
                              Change
                            </Button>
                          </BlockStack>
                        </InlineStack>
                      </Banner>
                    ) : (
                      <Button 
                        variant="primary" 
                        onClick={() => setIsWipeModalOpen(true)}
                      >
                        Select Wipe Product
                      </Button>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Save Button */}
              <Button 
                variant="primary" 
                tone="success" 
                onClick={handleSubmit}
                fullWidth
              >
                Save Bundle
              </Button>
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>

      {/* Modals */}
      <Modal
        open={isPlaceholderModalOpen}
        onClose={() => setIsPlaceholderModalOpen(false)}
        title="Select a Placeholder Product"
        primaryAction={null}
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
            items={filteredPlaceholderProducts}
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
                  onClick={() => {
                    setPlaceholderProductSelection(id);
                    setIsPlaceholderModalOpen(false);
                  }}
                >
                  <InlineStack gap="4" blockAlign="center">
                    <Text variant="bodyMd">{title}</Text>
                    {placeholderProductSelection === id && (
                      <Text variant="bodyMd" tone="success">
                        Selected
                      </Text>
                    )}
                  </InlineStack>
                </ResourceItem>
              );
            }}
          />
        </Modal.Section>
      </Modal>

      <Modal
        open={isWipeModalOpen}
        onClose={() => setIsWipeModalOpen(false)}
        title="Select a Wipe Product"
        primaryAction={null}
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
            items={filteredWipeProducts}
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
                  onClick={() => {
                    setWipeProductSelection(id);
                    setIsWipeModalOpen(false);
                  }}
                >
                  <InlineStack gap="4" blockAlign="center">
                    <Text variant="bodyMd">{title}</Text>
                    {wipeProductSelection === id && (
                      <Text variant="bodyMd" tone="success">
                        Selected
                      </Text>
                    )}
                  </InlineStack>
                </ResourceItem>
              );
            }}
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
