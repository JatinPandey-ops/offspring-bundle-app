// app/routes/bundles.jsx

import {
  Page,
  Card,
  Button,
  Modal,
  ResourceList,
  ResourceItem,
  Text,
  TextField,
  Checkbox,
  Badge,
  Banner,
  Divider,
  Grid,
  BlockStack,
  Box,
  InlineStack,
  Layout,
  EmptyState,
  Icon,
  Spinner,
} from "@shopify/polaris";
import { useLoaderData, useFetcher, json } from "@remix-run/react";
import { useState, useCallback } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { SearchIcon, DeleteIcon } from '@shopify/polaris-icons';
import prisma from "../db.server";

// Loader function to fetch bundles and products
export const loader = async () => {
  try {
    const bundles = await prisma.bundle.findMany({
      include: {
        bundleProducts: {
          include: {
            product: {
              include: {
                images: true,
                variants: true,
              },
            },
          },
        },
        bundleVariants: {
          include: {
            variant: true,
          },
        },
        wipeProduct: {
          include: {
            images: true,
            variants: true,
          },
        },
      },
    });

    const allProducts = await prisma.product.findMany({
      include: {
        images: true,
        variants: true,
      },
    });

    return json({ bundles, allProducts });
  } catch (error) {
    console.error("Error loading data:", error);
    return json({ bundles: [], allProducts: [] });
  }
};

// Action function to handle bundle operations
export const action = async ({ request }) => {
  try {
    const formData = await request.formData();
    const method = request.method.toLowerCase();

    // Handle bundle deletion
    if (method === "delete") {
      const bundleId = formData.get("bundleId");
      await prisma.bundle.delete({
        where: { id: bundleId },
      });
      return json({ success: true });
    }

    // Handle bundle update
    if (method === "post") {
      const bundleId = formData.get("bundleId");
      const userChosenName = formData.get("userChosenName");
      const price = parseFloat(formData.get("price"));
      const compareAtPrice = parseFloat(formData.get("compareAtPrice")) || null;
      const maxSelections = parseInt(formData.get("maxSelections"), 10) || null;
      const singleDesignSelection = formData.get("singleDesignSelection") === "true";
      const singleSizeSelection = formData.get("singleSizeSelection") === "true";
      const updatedProducts = JSON.parse(formData.get("updatedProducts"));
      const wipeProductId = formData.get("wipeProductId");
      const wipesQuantity = parseInt(formData.get("wipesQuantity"), 10);

      // Create the update data object
      const updateData = {
        userChosenName,
        price,
        compareAtPrice,
        maxSelections,
        singleDesignSelection,
        singleSizeSelection,
        wipesQuantity: wipesQuantity || null,
        wipeProductId: wipeProductId || null,
        bundleProducts: {
          deleteMany: {},
          create: updatedProducts.map((productId) => ({
            product: {
              connect: { id: productId }
            }
          }))
        }
      };

      // Update the bundle
      const updatedBundle = await prisma.bundle.update({
        where: { id: bundleId },
        data: updateData,
        include: {
          bundleProducts: {
            include: {
              product: {
                include: {
                  images: true,
                  variants: true
                }
              }
            }
          },
          wipeProduct: {
            include: {
              variants: true,
              images: true
            }
          }
        }
      });

      return json({ 
        success: true, 
        bundle: updatedBundle 
      });
    }

    return json({ 
      success: false, 
      error: "Invalid method" 
    });

  } catch (error) {
    console.error("Error in action:", error);
    return json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Main component
export default function BundlesPage() {
  // State management
  const loaderData = useLoaderData();
  const bundles = loaderData?.bundles ?? [];
  const allProducts = loaderData?.allProducts ?? [];
  const fetcher = useFetcher();

  // Bundle editing state
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundlePrice, setBundlePrice] = useState(0);
  const [compareAtPrice, setCompareAtPrice] = useState(0);
  const [maxSelections, setMaxSelections] = useState(5);
  const [singleDesignSelection, setSingleDesignSelection] = useState(false);
  const [bundleProducts, setBundleProducts] = useState([]);

  // Product search state
  const [searchValue, setSearchValue] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Wipe product state
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeSearchValue, setWipeSearchValue] = useState("");
  const [filteredWipeProducts, setFilteredWipeProducts] = useState([]);
  const [wipesQuantity, setWipesQuantity] = useState(0);

  // Helper functions
  const getMainProductImage = useCallback((product) => {
    return product.images && product.images.length > 0
      ? product.images[0].src
      : "/api/placeholder/80/80";
  }, []);

  const formatPrice = useCallback((price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
    }).format(price || 0);
  }, []);

  // Modal handlers
  const openModal = useCallback((bundle) => {
    setSelectedBundle(bundle);
    setBundleName(bundle.userChosenName);
    setBundlePrice(bundle.price);
    setCompareAtPrice(bundle.compareAtPrice || 0);
    setMaxSelections(bundle.maxSelections || 5);
    setSingleDesignSelection(bundle.singleDesignSelection || false);
    setBundleProducts(bundle.bundleProducts);
    setWipesQuantity(bundle.wipesQuantity || 0);
    setIsModalOpen(true);
    setSearchValue("");
    setFilteredProducts([]);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedBundle(null);
    setSearchValue("");
    setFilteredProducts([]);
    setWipesQuantity(0);
  }, []);

  // Product handlers
  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
    if (!value.trim()) {
      setFilteredProducts([]);
      return;
    }
    
    const searchTerm = value.toLowerCase();
    const filtered = allProducts.filter((product) =>
      product.title.toLowerCase().includes(searchTerm) || 
      product.vendor?.toLowerCase().includes(searchTerm) ||
      product.productType?.toLowerCase().includes(searchTerm)
    );
    setFilteredProducts(filtered);
  }, [allProducts]);

  const handleAddProduct = useCallback((product) => {
    if (!bundleProducts.some((bp) => bp.product.id === product.id)) {
      setBundleProducts((prev) => [...prev, { product }]);
    }
  }, [bundleProducts]);

  const handleDeleteProduct = useCallback((productId) => {
    const confirmed = window.confirm("Are you sure you want to remove this product from the bundle?");
    if (confirmed) {
      setBundleProducts((prev) =>
        prev.filter((bundleProduct) => bundleProduct.product.id !== productId)
      );
    }
  }, []);

  // Bundle handlers
  const handleDeleteBundle = useCallback((bundleId) => {
    const confirmed = window.confirm("Are you sure you want to delete this bundle? This action cannot be undone.");
    if (confirmed) {
      fetcher.submit({ bundleId }, { method: "delete" });
    }
  }, [fetcher]);

  // Wipe product handlers
  const handleWipeSearchChange = useCallback((value) => {
    setWipeSearchValue(value);
    const filtered = allProducts.filter(product => 
      product.title.toLowerCase().includes("wipe") &&
      product.title.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredWipeProducts(filtered);
  }, [allProducts]);

  const handleWipeProductSelect = useCallback((product) => {
    setSelectedBundle(prev => ({
      ...prev,
      wipeProduct: product,
      wipeProductId: product.id
    }));
  }, []);

  const handleRemoveWipeProduct = useCallback(() => {
    setSelectedBundle(prev => ({
      ...prev,
      wipeProduct: null,
      wipeProductId: null
    }));
    setWipesQuantity(0);
  }, []);

  // Save changes handler
  const handleSaveChanges = useCallback(() => {
    if (!selectedBundle) return;
    
    const formData = {
      bundleId: selectedBundle.id,
      userChosenName: bundleName,
      price: bundlePrice,
      compareAtPrice: compareAtPrice,
      maxSelections: maxSelections,
      singleDesignSelection: singleDesignSelection.toString(),
      updatedProducts: JSON.stringify(bundleProducts.map((bp) => bp.product.id)),
      wipeProductId: selectedBundle.wipeProduct?.id || '',
      wipesQuantity: wipesQuantity || 0,
    };
  
    fetcher.submit(formData, { method: "post" });
    closeModal();
  }, [
    selectedBundle,
    bundleName,
    bundlePrice,
    compareAtPrice,
    maxSelections,
    singleDesignSelection,
    bundleProducts,
    wipesQuantity,
    fetcher,
    closeModal,
  ]);

  // Loading state
  if (!loaderData) {
    return (
      <Page>
        <TitleBar title="Bundle Management" />
        <Box display="flex" align="center" justify="center" minHeight="60vh">
          <Spinner size="large" />
        </Box>
      </Page>
    );
  }

  const renderEmptyState = () => (
    <EmptyState
      heading="Create your first bundle"
      action={{
        content: 'Create Bundle',
        onAction: () => {}, 
      }}
      image="/api/placeholder/400/200"
    >
      <p>Create product bundles to offer your customers great deals and increase sales.</p>
    </EmptyState>
  );

  return (
    <Page fullWidth>
      <TitleBar title="Bundle Management" />
      
      {/* Main Layout */}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Header Banner */}
            <Box paddingBlockEnd="400">
              <Banner title="Bundle Overview" status="info">
                <p>Manage your product bundles, set prices, and configure product selections.</p>
              </Banner>
            </Box>

            {/* Bundle Grid */}
            {bundles.length === 0 ? (
              renderEmptyState()
            ) : (
              <Grid>
                {bundles.map((bundle) => (
                  <Grid.Cell key={bundle.id} columnSpan={{ xs: 12, sm: 12, md: 6, lg: 6, xl: 6 }}>
                    <Card padding="400">
                      <BlockStack gap="400">
                        {/* Bundle Header */}
                        <InlineStack align="space-between">
                          <Text variant="headingMd" as="h2">
                            {bundle.userChosenName}
                          </Text>
                          <Badge tone={bundle.singleDesignSelection ? "success" : "info"}>
                            {bundle.singleDesignSelection ? "Single Design" : "Multi Design"}
                          </Badge>
                        </InlineStack>

                        <Divider />

                        {/* Price Section */}
                        <BlockStack gap="200">
                          <Text as="p" color="subdued">
                            {bundle.bundleProducts?.length || 0} Products
                          </Text>
                          <InlineStack gap="200" align="start">
                            <Text variant="heading2xl">
                              {formatPrice(bundle.price)}
                            </Text>
                            {bundle.compareAtPrice > 0 && (
                              <Text variant="bodyMd" color="subdued" textDecorationLine="line-through">
                                {formatPrice(bundle.compareAtPrice)}
                              </Text>
                            )}
                          </InlineStack>
                        </BlockStack>

                        {/* Products List */}
                        <Box paddingBlock="400">
                          <BlockStack gap="300">
                            {/* Regular Products */}
                            {bundle.bundleProducts?.slice(0, 3).map((bp) => (
                              <Box
                                key={bp.product.id}
                                padding="300"
                                background="bg-subdued"
                                borderRadius="200"
                              >
                                <InlineStack gap="300">
                                  <img
                                    src={getMainProductImage(bp.product)}
                                    alt={bp.product.title}
                                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px' }}
                                  />
                                  <BlockStack gap="100">
                                    <Text variant="bodyMd">
                                      {bp.product.title}
                                    </Text>
                                    {bp.product.variants && bp.product.variants.length > 0 && (
                                      <Text variant="bodySm" color="subdued">
                                        {bp.product.variants.length} variants
                                      </Text>
                                    )}
                                  </BlockStack>
                                </InlineStack>
                              </Box>
                            ))}

                            {/* More Products Indicator */}
                            {bundle.bundleProducts?.length > 3 && (
                              <Text variant="bodySm" color="subdued" alignment="center">
                                +{bundle.bundleProducts.length - 3} more products
                              </Text>
                            )}

                            {/* Wipe Product */}
                            {bundle.wipeProduct && (
                              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                                <BlockStack gap="200">
                                  <InlineStack align="space-between">
                                    <Text variant="headingSm">Wipe Product</Text>
                                    <Badge tone="info">Qty: {bundle.wipesQuantity || 0}</Badge>
                                  </InlineStack>
                                  <InlineStack gap="300">
                                    <img
                                      src={getMainProductImage(bundle.wipeProduct)}
                                      alt={bundle.wipeProduct.title}
                                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px' }}
                                    />
                                    <Text variant="bodyMd">{bundle.wipeProduct.title}</Text>
                                  </InlineStack>
                                </BlockStack>
                              </Box>
                            )}
                          </BlockStack>
                        </Box>

                        {/* Action Buttons */}
                        {/* Action Buttons */}
                        <InlineStack gap="300">
                          <Button primary onClick={() => openModal(bundle)}>
                            Edit Bundle
                          </Button>
                          <Button variant="primary" tone="critical" onClick={() => handleDeleteBundle(bundle.id)}>
                            Delete
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                ))}
              </Grid>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Edit Bundle Modal */}
      {selectedBundle && (
        <Modal
          large
          open={isModalOpen}
          onClose={closeModal}
          title="Edit Bundle"
          primaryAction={{
            content: "Save Changes",
            onAction: handleSaveChanges,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: closeModal,
            },
          ]}
        >
          {/* Basic Bundle Information */}
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                {bundleName}
              </Text>
              
              <Grid>
                <Grid.Cell columnSpan={{ xs: 4, sm: 4, md: 4 }}>
                  <TextField
                    label="Price"
                    type="number"
                    value={bundlePrice}
                    onChange={(value) => setBundlePrice(parseFloat(value))}
                    prefix="RM"
                    autoComplete="off"
                    error={bundlePrice < 0 ? "Price must be positive" : undefined}
                  />
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 4, sm: 4, md: 4 }}>
                  <TextField
                    label="Compare At Price"
                    type="number"
                    value={compareAtPrice}
                    onChange={(value) => setCompareAtPrice(parseFloat(value))}
                    prefix="RM"
                    autoComplete="off"
                  />
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 4, sm: 4, md: 4 }}>
                  <TextField
                    label="Max Selections"
                    type="number"
                    value={maxSelections}
                    onChange={(value) => setMaxSelections(parseInt(value, 10))}
                    autoComplete="off"
                    min={1}
                  />
                </Grid.Cell>
              </Grid>

              <Box paddingBlockStart="400">
                <Checkbox
                  label="Single Design Selection"
                  checked={singleDesignSelection}
                  onChange={setSingleDesignSelection}
                  helpText="Allow customers to select only one design across all products"
                />
              </Box>
            </BlockStack>
          </Modal.Section>

          {/* Current Products Section */}
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">Current Products</Text>

              {bundleProducts.length === 0 ? (
                <Banner tone="info">
                  <p>No products in this bundle yet. Use the search below to add products.</p>
                </Banner>
              ) : (
                <ResourceList
                  resourceName={{ singular: 'product', plural: 'products' }}
                  items={bundleProducts}
                  renderItem={(item) => {
                    const { product } = item;
                    return (
                      <ResourceItem
                        id={product.id}
                        media={
                          <img
                            src={getMainProductImage(product)}
                            alt={product.title}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px' }}
                          />
                        }
                      >
                        <BlockStack gap="200">
                          <InlineStack align="space-between">
                            <Text variant="bodyMd" fontWeight="bold">
                              {product.title}
                            </Text>
                            <Button
                              variant="primary" 
                              tone="critical" 
                              onClick={() => handleDeleteProduct(product.id)}
                              icon={DeleteIcon}
                            >
                              Remove
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      </ResourceItem>
                    );
                  }}
                />
              )}
            </BlockStack>
          </Modal.Section>

          {/* Wipe Product Section */}
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">Wipe Product Settings</Text>
              
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                {selectedBundle.wipeProduct ? (
                  <BlockStack gap="300">
                    <InlineStack gap="300" align="space-between" blockAlign="center">
                      <InlineStack gap="300">
                        <img
                          src={getMainProductImage(selectedBundle.wipeProduct)}
                          alt={selectedBundle.wipeProduct.title}
                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px' }}
                        />
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="bold">
                            {selectedBundle.wipeProduct.title}
                          </Text>
                          <Text variant="bodySm" color="subdued">
                            Selected Wipe Product
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <Button 
                        variant="plain"
                        tone="critical"
                        onClick={handleRemoveWipeProduct}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                    
                    <TextField
                      label="Wipes Quantity"
                      type="number"
                      value={wipesQuantity}
                      onChange={(value) => setWipesQuantity(parseInt(value, 10))}
                      autoComplete="off"
                      helpText="Number of wipes to include with this bundle"
                      min={0}
                    />
                  </BlockStack>
                ) : (
                  <InlineStack align="center" gap="400">
                    <Text variant="bodyMd">No wipe product selected</Text>
                  </InlineStack>
                )}
              </Box>
            </BlockStack>
          </Modal.Section>
          <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Search Wipe Products"
              value={wipeSearchValue}
              onChange={handleWipeSearchChange}
              autoComplete="off"
              placeholder="Search for wipe products..."
              prefix={<Icon source={SearchIcon} />}
              clearButton
              onClearButtonClick={() => setWipeSearchValue("")}
            />

            <Box paddingBlockStart="400">
              {filteredWipeProducts.length > 0 ? (
                <ResourceList
                  resourceName={{ singular: 'product', plural: 'products' }}
                  items={filteredWipeProducts}
                  renderItem={(product) => (
                    <ResourceItem
                      id={product.id}
                      onClick={() => handleWipeProductSelect(product)}
                      media={
                        <img
                          src={getMainProductImage(product)}
                          alt={product.title}
                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px' }}
                        />
                      }
                    >
                      <Text variant="bodyMd" fontWeight="bold">
                        {product.title}
                      </Text>
                    </ResourceItem>
                  )}
                />
              ) : (
                <Banner tone="info">
                  <p>No wipe products found. Try adjusting your search.</p>
                </Banner>
              )}
            </Box>
          </BlockStack>
        </Modal.Section>

          {/* Add Products Section */}
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">Add Products</Text>
              <TextField
                label="Search products"
                value={searchValue}
                onChange={handleSearchChange}
                autoComplete="off"
                placeholder="Search by product name, type, or vendor..."
                prefix={<Icon source={SearchIcon} />}
                clearButton
                onClearButtonClick={() => handleSearchChange("")}
              />

              {searchValue && (
                <Box paddingBlockStart="400">
                  {filteredProducts.length > 0 ? (
                    <ResourceList
                      resourceName={{ singular: 'product', plural: 'products' }}
                      items={filteredProducts}
                      renderItem={(product) => (
                        <ResourceItem
                          id={product.id}
                          onClick={() => handleAddProduct(product)}
                          media={
                            <img
                              src={getMainProductImage(product)}
                              alt={product.title}
                              style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '4px' }}
                            />
                          }
                        >
                          <BlockStack gap="200">
                            <Text variant="bodyMd" fontWeight="bold">
                              {product.title}
                            </Text>
                            {product.vendor && (
                              <Text variant="bodySm" color="subdued">
                                Vendor: {product.vendor}
                              </Text>
                            )}
                          </BlockStack>
                        </ResourceItem>
                      )}
                    />
                  ) : (
                    <Banner tone="warning">
                      <p>No products found matching your search.</p>
                    </Banner>
                  )}
                </Box>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
