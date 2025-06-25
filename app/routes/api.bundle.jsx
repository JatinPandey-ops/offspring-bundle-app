import { json } from '@remix-run/node';
import prisma from '../db.server.js';
import { cors } from 'remix-utils/cors';

export const loader = async ({ request }) => {
  try {
    // Parse the request URL and get the placeholderProductId
    const url = new URL(request.url);
    const placeholderProductId = url.searchParams.get('placeholderProductId');

    if (!placeholderProductId) {
      return json({ error: 'No placeholderProductId provided' }, { status: 400 });
    }

    // Query the Prisma database for the bundle associated with the placeholderProductId
    const bundle = await prisma.bundle.findUnique({
      where: { id: placeholderProductId }, // The id in the Bundle model corresponds to the placeholderProductId
      include: {
        // Include bundleProducts and their related products, variants, and images
        bundleProducts: {
          include: {
            product: {
              include: {
                variants: true, // Include variants of each product
                images: true,   // Include images of each product
              },
            },
          },
        },
        // Include bundleVariants and their related variants
        bundleVariants: {
          include: {
            variant: true, // Include the variant details
          },
        },
        // Include the wipeProduct if it exists
        wipeProduct: true,
      },
    });

    if (!bundle) {
      return json({ error: 'Bundle not found' }, { status: 404 });
    }

    // Return the bundle and associated data as a response
    const response = json({ bundle }, { status: 200 });
    return cors(request, response);
  } catch (error) {
    console.error('Error in loader:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
