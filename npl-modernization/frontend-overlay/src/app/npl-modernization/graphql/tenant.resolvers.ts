import { GraphQLResolvers } from '@graphql-codegen/types';
import { TenantService } from './tenant.service';

export const tenantResolvers: GraphQLResolvers = {
  Query: {
    // Get tenant by ID
    tenant: async (_, { id }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getTenantById(id);
    },

    // Get tenant info by ID
    tenantInfo: async (_, { id }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getTenantInfoById(id);
    },

    // Get all tenants
    tenants: async (_, __, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getAllTenants();
    },

    // Get all tenant infos
    tenantInfos: async (_, __, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getAllTenantInfos();
    },

    // Get tenants with pagination
    tenantsPaginated: async (_, { pageSize, page }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getTenantsPaginated(pageSize, page);
    },

    // Get tenant infos with pagination
    tenantInfosPaginated: async (_, { pageSize, page }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getTenantInfosPaginated(pageSize, page);
    },

    // Search tenants by name or title
    searchTenants: async (_, { searchTerm }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.searchTenants(searchTerm);
    },

    // Get tenant count
    tenantCount: async (_, __, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getTenantCount();
    },

    // Check if tenant exists
    tenantExists: async (_, { id }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.tenantExists(id);
    },

    // Get tenant by name
    tenantByName: async (_, { name }, { tenantService }: { tenantService: TenantService }) => {
      return await tenantService.getTenantByName(name);
    }
  },

  Subscription: {
    // Real-time subscriptions for tenant events
    tenantCreated: {
      subscribe: (_, __, { pubsub }: { pubsub: any }) => {
        return pubsub.asyncIterator(['TENANT_CREATED']);
      }
    },

    tenantUpdated: {
      subscribe: (_, __, { pubsub }: { pubsub: any }) => {
        return pubsub.asyncIterator(['TENANT_UPDATED']);
      }
    },

    tenantDeleted: {
      subscribe: (_, __, { pubsub }: { pubsub: any }) => {
        return pubsub.asyncIterator(['TENANT_DELETED']);
      }
    },

    tenantsBulkImported: {
      subscribe: (_, __, { pubsub }: { pubsub: any }) => {
        return pubsub.asyncIterator(['TENANTS_BULK_IMPORTED']);
      }
    },

    tenantsBulkDeleted: {
      subscribe: (_, __, { pubsub }: { pubsub: any }) => {
        return pubsub.asyncIterator(['TENANTS_BULK_DELETED']);
      }
    }
  }
}; 