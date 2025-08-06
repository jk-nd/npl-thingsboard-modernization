import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

// Services
import { TenantService } from './tenant.service';
import { NplReadModelService } from '../npl-read-model/npl-read-model.service';

// Resolvers
import { tenantResolvers } from './tenant.resolvers';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req }) => ({
        req,
        tenantService: new TenantService(new NplReadModelService())
      })
    })
  ],
  providers: [
    TenantService,
    NplReadModelService,
    {
      provide: 'TenantResolvers',
      useValue: tenantResolvers
    }
  ],
  exports: [TenantService, NplReadModelService]
})
export class AppGraphQLModule {} 