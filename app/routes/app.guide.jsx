import React from 'react';
import { Page, Layout, Card, Text, Button, List, Icon, Image } from '@shopify/polaris';

function BundleCreationGuide() {
  return (
    <Page title="Bundle Creation Guide">
      <Layout>
        {/* Introduction */}
        <Layout.Section>
          <Card sectioned>
            <Text as="p">
              This guide will help you create both custom and pre-made bundles using our app. Follow the step-by-step instructions below to set up bundles that your customers can enjoy.
            </Text>
          </Card>
        </Layout.Section>

        {/* Creating a Custom Bundle */}
        <Layout.AnnotatedSection
          title="Creating a Custom Bundle"
          description="Follow these steps to create a custom bundle."
        >
          {/* Step 1 */}
          <Card sectioned>
            <Text as="h2">Step 1: Navigate to the 'Create Bundle' Page</Text>
            <List type="number">
              <List.Item>
                From your admin dashboard, click on <Text as="strong">Bundles</Text> in the sidebar.
              </List.Item>
              <List.Item>
                Select <Text as="strong">Create Bundle</Text>.
              </List.Item>
            </List>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Admin dashboard highlighting the 'Create Bundle' option" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 2 */}
          <Card sectioned>
            <Text as="h2">Step 2: Select Products</Text>
            <Text as="p">
              - You'll see a list of all products available in your store.
              <br />
              - Browse or search for the products you want to include in the bundle.
              <br />
              - Click on the products to select them.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="List of products with some selected" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 3 */}
          <Card sectioned>
            <Text as="h2">Step 3: Review Selected Products</Text>
            <Text as="p">
              - A side panel will appear showing all the products you've selected.
              <br />
              - Each product will display its image and title.
              <br />
              - If you need to remove a product, click the <Text as="strong">Remove</Text> button next to it.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Side panel displaying selected products with 'Remove' buttons" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 4 */}
          <Card sectioned>
            <Text as="h2">Step 4: Configure Bundle Options</Text>

            {/* Max Selections in Bundle */}
            <Card sectioned subdued>
              <Text as="h3">Max Selections in Bundle</Text>
              <Text as="p">
                Set the <Text as="strong">Max Selections in Bundle</Text> to the number of items a customer can select when purchasing the bundle.
                <br />
                <Text as="span" variant="bodySm" color="subdued">Example:</Text> If set to <Text as="strong">5</Text>, customers can choose up to 5 items.
              </Text>
              {/* Image Placeholder */}
              <div style={{ marginTop: '20px' }}>
                <Image alt="Setting 'Max Selections in Bundle' to 5" source="your-image-source.jpg" />
              </div>
            </Card>

            {/* Allow Single Design Selection */}
            <Card sectioned subdued>
              <Text as="h3">Allow Single Design Selection</Text>
              <Text as="p">
                Toggle the <Text as="strong">Allow Single Design Selection</Text> option based on your preference:
              </Text>
              <List type="bullet">
                <List.Item>
                  <Text as="strong">Enabled:</Text> Customers can mix and match sizes and types, but can only select one design.
                </List.Item>
                <List.Item>
                  <Text as="strong">Disabled:</Text> Customers can mix and match sizes, types, and designs freely.
                </List.Item>
              </List>
              {/* Image Placeholder */}
              <div style={{ marginTop: '20px' }}>
                <Image alt="Toggle switch for 'Allow Single Design Selection'" source="your-image-source.jpg" />
              </div>
            </Card>

            {/* Quantity of Wipes */}
            <Card sectioned subdued>
              <Text as="h3">Quantity of Wipes (Optional)</Text>
              <Text as="p">
                If you want to include wipes in the bundle, enter the quantity in <Text as="strong">Quantity of Wipes</Text>.
              </Text>
              {/* Image Placeholder */}
              <div style={{ marginTop: '20px' }}>
                <Image alt="Input field for 'Quantity of Wipes'" source="your-image-source.jpg" />
              </div>
            </Card>
          </Card>

          {/* Step 5 */}
          <Card sectioned>
            <Text as="h2">Step 5: Select Wipe Product (Optional)</Text>
            <Text as="p">
              - Click on <Text as="strong">Select Wipe Product</Text>.
              <br />
              - A popup will appear with a list of wipe products.
              <br />
              - Choose the wipe product you want to include.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Popup showing wipe products for selection" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 6 */}
          <Card sectioned>
            <Text as="h2">Step 6: Select Placeholder Product</Text>
            <Text as="p">
              - Click on <Text as="strong">Placeholder Product</Text>.
              <br />
              - A popup will open displaying your store's products.
              <br />
              - Select the product that will serve as the placeholder for the bundle on your storefront. This is where the variant selector for the bundle will be rendered.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Popup for selecting the placeholder product" source="your-image-source.jpg" />
            </div>
          </Card>
        </Layout.AnnotatedSection>

        {/* Creating a Pre-made Bundle */}
        <Layout.AnnotatedSection
          title="Creating a Pre-made Bundle"
          description="Follow these steps to create a pre-made bundle."
        >
          {/* Step 1 */}
          <Card sectioned>
            <Text as="h2">Step 1: Navigate to the 'Pre-made Bundle' Page</Text>
            <List type="number">
              <List.Item>
                From your admin dashboard, click on <Text as="strong">Bundles</Text> in the sidebar.
              </List.Item>
              <List.Item>
                Select <Text as="strong">Pre-made Bundle</Text>.
              </List.Item>
            </List>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Admin dashboard highlighting the 'Pre-made Bundle' option" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 2 */}
          <Card sectioned>
            <Text as="h2">Step 2: Select a Product</Text>
            <Text as="p">
              - You'll see a list of all your products.
              <br />
              - Find the product you want to create a bundle for and click <Text as="strong">Select</Text>.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="List of products with 'Select' buttons" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 3 */}
          <Card sectioned>
            <Text as="h2">Step 3: Select Variants</Text>
            <Text as="p">
              - A popup will appear showing all variants of the selected product.
              <br />
              - Check the variants you want to include in the bundle.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Popup displaying product variants with checkboxes" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 4 */}
          <Card sectioned>
            <Text as="h2">Step 4: Review and Set Quantities</Text>
            <Text as="p">
              - A side panel will open displaying the selected variants with their images and titles.
              <br />
              - For each variant, enter the quantity you want to include in the bundle.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Side panel with selected variants and quantity input fields" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 5 */}
          <Card sectioned>
            <Text as="h2">Step 5: Select Wipe Product (Optional)</Text>
            <Text as="p">
              - Similar to the custom bundle, click on <Text as="strong">Select Wipe Product</Text> if you wish to include wipes.
              <br />
              - Choose the wipe product from the popup and set the desired quantity.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Selecting wipe product and setting quantity" source="your-image-source.jpg" />
            </div>
          </Card>

          {/* Step 6 */}
          <Card sectioned>
            <Text as="h2">Step 6: Select Placeholder Product</Text>
            <Text as="p">
              - Click on <Text as="strong">Placeholder Product</Text>.
              <br />
              - Choose the product that will display the bundle on your storefront.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Popup for selecting the placeholder product" source="your-image-source.jpg" />
            </div>
          </Card>
        </Layout.AnnotatedSection>

        {/* Finalizing the Bundle */}
        <Layout.Section>
          <Card sectioned>
            <Text as="h2">Finalizing the Bundle</Text>
            <Text as="p">
              - Review all your selections and configurations.
              <br />
              - Click <Text as="strong">Save</Text> or <Text as="strong">Create Bundle</Text> to finalize.
            </Text>
            {/* Image Placeholder */}
            <div style={{ marginTop: '20px' }}>
              <Image alt="Save or Create Bundle button" source="your-image-source.jpg" />
            </div>
          </Card>
        </Layout.Section>

        {/* Tips */}
        <Layout.Section>
          <Card sectioned title="Tips">
            <List type="bullet">
              <List.Item>
                <Text as="strong">Inventory Management:</Text> The inventory of the selected variants will be adjusted automatically when customers purchase the bundle.
              </List.Item>
              <List.Item>
                <Text as="strong">Customer Experience:</Text> Use clear product images and titles to help customers easily understand what's included in the bundle.
              </List.Item>
              <List.Item>
                <Text as="strong">Testing:</Text> After creating the bundle, visit your storefront to ensure everything displays correctly.
              </List.Item>
            </List>
          </Card>
        </Layout.Section>

        {/* Conclusion */}
        <Layout.Section>
          <Card sectioned>
            <Text as="p">
              By following these steps, you can create customized or pre-made bundles that cater to your customers' preferences, enhancing their shopping experience and potentially increasing sales.
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default BundleCreationGuide;
