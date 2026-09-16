import { Router } from 'express';

export const docsRouter = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Property Rental Management System REST API',
    version: '1.0.0',
    description: 'Enterprise REST API v1 for Property Rental Management System, supporting Super Admins, Property Owners, Tenants, and Service Providers.'
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Production API v1'
    }
  ],
  paths: {
    '/auth/login': {
      post: {
        summary: 'User Login',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'owner1@greenliving.com' },
                  password: { type: 'string', example: 'Owner@123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Access and Refresh Tokens returned' },
          401: { description: 'Invalid email or password' }
        }
      }
    },
    '/auth/register': {
      post: {
        summary: 'Tenant Registration',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                  fullName: { type: 'string' },
                  phone: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Tenant registered successfully' },
          409: { description: 'Email already exists' }
        }
      }
    },
    '/admin/owners': {
      post: {
        summary: 'Atomic Owner & Company Creation',
        tags: ['Super Admin'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Owner user, company, and admin membership created atomically' } }
      }
    },
    '/admin/providers': {
      post: {
        summary: 'Atomic Provider & Company Creation',
        tags: ['Super Admin'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Provider user, company, and admin membership created atomically' } }
      }
    },
    '/buildings': {
      get: {
        summary: 'List Buildings with filters',
        tags: ['Properties'],
        responses: { 200: { description: 'Array of buildings' } }
      },
      post: {
        summary: 'Create Building',
        tags: ['Properties'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Building created' } }
      }
    },
    '/rooms': {
      get: {
        summary: 'Search and Filter Rooms',
        tags: ['Properties'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'INACTIVE'] } },
          { name: 'roomType', in: 'query', schema: { type: 'string', enum: ['STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOM', 'PENTHOUSE', 'DUPLEX'] } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Filtered room list' } }
      }
    },
    '/rentals/applications': {
      post: {
        summary: 'Submit Rental Application',
        tags: ['Rentals'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Application submitted' } }
      }
    },
    '/invoices/generate': {
      post: {
        summary: 'Generate Monthly Invoice with Versioned Pricing',
        tags: ['Billing'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Invoice and line items generated' } }
      }
    },
    '/payments': {
      post: {
        summary: 'Process Payment with Atomic Balance Update',
        tags: ['Billing'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Payment recorded and invoice balance updated' } }
      }
    },
    '/services': {
      get: {
        summary: 'Browse Available Services',
        tags: ['Services'],
        responses: { 200: { description: 'Catalog of provider services' } }
      }
    },
    '/service-requests': {
      post: {
        summary: 'Submit Service Request',
        tags: ['Services'],
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Service request created' } }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

docsRouter.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

docsRouter.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Property Rental API v1 - Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { background: #0f172a; padding: 12px 24px; color: #fff; display: flex; align-items: center; justify-content: space-between; }
    .topbar h1 { margin: 0; font-size: 18px; font-weight: 600; }
    .topbar a { color: #38bdf8; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Property Rental Management System — API v1 Reference</h1>
    <a href="/">← Return to App</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
  `;
  res.send(html);
});
