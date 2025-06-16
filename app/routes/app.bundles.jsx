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
    const {session,  admin } = await authenticate.admin(request);
    console.log(session)
    const shopDomain = session.shop;

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

      // console.log(`Processing product: ${productNode.title}`);

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
          // console.log(`Updating existing product: ${productNode.title}`);
          await prisma.product.update({
            where: { id: shopifyProductId },
            data: {
              shop: shopDomain,
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
          // console.log(`Creating new product: ${productNode.title}`);
          await prisma.product.create({
            data: {
              id: shopifyProductId,
              shop:  shopDomain,
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
    const dbProducts = await prisma.product.findMany({
      where: { shop: shopDomain },
      include: {
        variants: true,
        images:   true,
      },
    });
    console.log("Returning all products to the client...");
    return json({ products: dbProducts, shop: shopDomain });
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ error: "Failed to load products" }, { status: 500 });
  }
};


// Action function to handle form submission and save the bundle
// Changes to make in the action function
export const action = async ({ request }) => {
  console.log("Action function started");

  // 1) authenticate and grab the shop domain
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  console.log("Shop domain:", shopDomain);

  // 2) pull in form values
  const formData = await request.formData();
  const selectedProductIds = JSON.parse(formData.get("selectedProductIds"));
  let placeholderProductId = formData
    .get("placeholderProductId")
    .replace("gid://shopify/Product/", "");
  const maxSelections = parseInt(formData.get("maxSelections"), 10);
  const singleDesignSelection = formData.get("singleDesignSelection") === "true";
  const singleSizeSelection = formData.get("singleSizeSelection") === "true";
  const wipesQuantity = formData.get("wipesQuantity")
    ? parseInt(formData.get("wipesQuantity"), 10)
    : null;

  // 3) handle optional wipe product
  let wipeProductId = formData.get("wipeProductId")
    ? formData.get("wipeProductId").replace("gid://shopify/Product/", "")
    : null;
  let wipeVariantId = null;

  console.log("Selected Product IDs:", selectedProductIds);
  console.log("Placeholder Product ID:", placeholderProductId);
  console.log("Wipe Product ID:", wipeProductId);

  try {
    if (wipeProductId) {
      console.log("Checking wipe product in DB...");
      const wipeProduct = await prisma.product.findUnique({
        where: { id: wipeProductId },
        include: { variants: true },
      });
      if (!wipeProduct) {
        console.log(`→ No wipe product ${wipeProductId}, dropping it.`);
        wipeProductId = null;
      } else if (wipeProduct.variants.length) {
        wipeVariantId = wipeProduct.variants[0].id;
        console.log(`→ Using wipe variant ${wipeVariantId}`);
      }
    }

    // 4) fetch placeholder from DB
    console.log("Fetching placeholder from DB...");
    const placeholder = await prisma.product.findUnique({
      where: { id: placeholderProductId },
      include: { variants: true },
    });
    if (!placeholder) throw new Error("Placeholder product not found");

    console.log("Placeholder fetched:", placeholder.title);

    // 5) build bundle payload, now including shop
    const bundleData = {
      id: placeholderProductId,
      shop: shopDomain,                         // ← added shop here
      userChosenName: placeholder.title,
      price: parseFloat(placeholder.variants[0].price),
      maxSelections,
      singleDesignSelection,
      singleSizeSelection,
      wipesQuantity,
      wipeProductId,
      wipeVariantId,
      bundleProducts: {
        create: selectedProductIds.map((gid) => ({
          product: {
            connect: { id: gid.replace("gid://shopify/Product/", "") },
          },
        })),
      },
    };

    console.log("Creating bundle in DB:", bundleData);
    const newBundle = await prisma.bundle.create({
      data: bundleData,
      include: { bundleProducts: true },
    });

    console.log("Bundle created:", newBundle.id);
    return json({ success: true, bundle: newBundle });
  } catch (error) {
    console.error("Error in action:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};



// Client code: React component
export default function BundlePage() {
  const actionData = useActionData();
  const { products: initialProducts } = useLoaderData();
  const [products, setProducts] = useState(initialProducts);
  const [searchValue, setSearchValue] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
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

  // Show a toast in Shopify Admin
  const showToast = (message) => {
    shopify.toast.show(message, { duration: 5000 });
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

  // Filter by title (no .node wrapper)
  const filteredProducts =
    products?.filter((product) =>
      product.title.toLowerCase().includes(searchValue.toLowerCase())
    ) || [];

  const handleSelection = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = useCallback(() => {
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

    submit(formData, { method: "post" });
  }, [
    selectedItems,
    placeholderProductSelection,
    maxSelections,
    singleDesignSelection,
    singleSizeSelection,
    wipesQuantity,
    wipeProductSelection,
    submit,
  ]);

  useEffect(() => {
    if (actionData?.success) {
      showToast("Bundle created successfully!");
      resetFormState();
    } else if (actionData?.error) {
      showToast(actionData.error);
    }
  }, [actionData]);

  // Prepare placeholder list when modal opens
  useEffect(() => {
    if (isPlaceholderModalOpen) {
      setFilteredPlaceholderProducts(
        products.filter((p) =>
          p.title.toLowerCase().includes("bundle")
        )
      );
    }
  }, [isPlaceholderModalOpen, products]);

  // Prepare wipe list when modal opens
  useEffect(() => {
    if (isWipeModalOpen) {
      setFilteredWipeProducts(
        products.filter((p) =>
          p.title.toLowerCase().includes("wipes")
        )
      );
    }
  }, [isWipeModalOpen, products]);

  // Helper to get full product object by ID
  const getSelectedProductDetails = (productId) =>
    products.find((p) => p.id === productId) || null;

  const selectedPlaceholderProduct = placeholderProductSelection
    ? getSelectedProductDetails(placeholderProductSelection)
    : null;

  const selectedWipeProduct = wipeProductSelection
    ? getSelectedProductDetails(wipeProductSelection)
    : null;

  return (
    <Page>
      <Layout>
        {/* Product Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Product Selection
              </Text>
              <TextField
                label="Search Products"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search by product title"
                autoComplete="off"
              />
              <ResourceList
                resourceName={{ singular: "product", plural: "products" }}
                items={filteredProducts}
                renderItem={(item) => {
                  const { id, title, featuredImage } = item;
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
                        <Text variant="bodyMd" fontWeight="bold">
                          {title}
                        </Text>
                        <Button
                          variant={
                            selectedItems.includes(id) ? "secondary" : "primary"
                          }
                          onClick={() => handleSelection(id)}
                        >
                          {selectedItems.includes(id)
                            ? "Selected"
                            : "Select"}
                        </Button>
                      </BlockStack>
                    </ResourceItem>
                  );
                }}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Bundle Config */}
        {selectedItems.length > 0 && (
          <Layout.Section variant="oneThird">
            <BlockStack gap="4">
              {/* Selected Products */}
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">
                    Selected Products
                  </Text>
                  {selectedItems.map((id) => {
                    const prod = getSelectedProductDetails(id);
                    return (
                      <InlineStack
                        key={id}
                        align="space-between"
                        blockAlign="center"
                      >
                        <InlineStack gap="4" blockAlign="center">
                          <Thumbnail
                            source={prod?.featuredImage?.url || ""}
                            alt={prod?.featuredImage?.altText || prod?.title}
                          />
                          <Text variant="bodyMd">{prod?.title}</Text>
                        </InlineStack>
                        <Button
                          variant="plain"
                          onClick={() => handleSelection(id)}
                        >
                          Remove
                        </Button>
                      </InlineStack>
                    );
                  })}
                </BlockStack>
              </Card>

              {/* Bundle Settings */}
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">
                    Bundle Settings
                  </Text>
                  <TextField
                    type="number"
                    label="Max Selections"
                    value={maxSelections}
                    onChange={(val) => setMaxSelections(val)}
                    min={1}
                  />
                  <Checkbox
                    label="Allow Single Design?"
                    checked={singleDesignSelection}
                    onChange={(val) => setSingleDesignSelection(val)}
                  />
                  <Checkbox
                    label="Allow Single Size/Type?"
                    checked={singleSizeSelection}
                    onChange={(val) => setSingleSizeSelection(val)}
                  />
                  <TextField
                    type="number"
                    label="Quantity of Wipes"
                    value={wipesQuantity}
                    onChange={(val) => setWipesQuantity(val)}
                    min={0}
                  />
                </BlockStack>
              </Card>

              {/* Placeholder & Wipe */}
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">
                    Required Products
                  </Text>

                  {/* Placeholder */}
                  <BlockStack gap="2">
                    <Text variant="headingSm" as="h3">
                      Placeholder Product
                    </Text>
                    {selectedPlaceholderProduct ? (
                      <Banner status="success">
                        <InlineStack gap="4" blockAlign="center">
                          <Thumbnail
                            source={
                              selectedPlaceholderProduct.featuredImage?.url ||
                              ""
                            }
                            alt={selectedPlaceholderProduct.title}
                          />
                          <BlockStack gap="1">
                            <Text variant="bodyMd" fontWeight="bold">
                              {selectedPlaceholderProduct.title}
                            </Text>
                            <Button
                              variant="plain"
                              onClick={() =>
                                setPlaceholderProductSelection(null)
                              }
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
                        Select Placeholder
                      </Button>
                    )}
                  </BlockStack>

                  <Divider />

                  {/* Wipe */}
                  <BlockStack gap="2">
                    <Text variant="headingSm" as="h3">
                      Wipe Product
                    </Text>
                    {selectedWipeProduct ? (
                      <Banner status="success">
                        <InlineStack gap="4" blockAlign="center">
                          <Thumbnail
                            source={
                              selectedWipeProduct.featuredImage?.url || ""
                            }
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
                        Select Wipe
                      </Button>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Save */}
              <Button
                variant="primary"
                tone="success"
                fullWidth
                onClick={handleSubmit}
              >
                Save Bundle
              </Button>
            </BlockStack>
          </Layout.Section>
        )}
      </Layout>

      {/* Placeholder Modal */}
      <Modal
        open={isPlaceholderModalOpen}
        onClose={() => setIsPlaceholderModalOpen(false)}
        title="Select a Placeholder Product"
        primaryAction={null}
        secondaryActions={[{ content: "Cancel", onAction: () => setIsPlaceholderModalOpen(false) }]}
      >
        <Modal.Section>
          <ResourceList
            resourceName={{ singular: "product", plural: "products" }}
            items={filteredPlaceholderProducts}
            renderItem={(item) => {
              const { id, title, featuredImage } = item;
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
                  accessibilityLabel={`Select ${title}`}
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

      {/* Wipe Modal */}
      <Modal
        open={isWipeModalOpen}
        onClose={() => setIsWipeModalOpen(false)}
        title="Select a Wipe Product"
        primaryAction={null}
        secondaryActions={[{ content: "Cancel", onAction: () => setIsWipeModalOpen(false) }]}
      >
        <Modal.Section>
          <ResourceList
            resourceName={{ singular: "product", plural: "products" }}
            items={filteredWipeProducts}
            renderItem={(item) => {
              const { id, title, featuredImage } = item;
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
                  accessibilityLabel={`Select ${title}`}
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