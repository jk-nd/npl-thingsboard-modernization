import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client/core';

// Services
import { NplClientService } from './services/npl-client.service';
import { DeviceGraphQLService } from './services/device-graphql.service';
import { RequestTransformerService } from './services/request-transformer.service';
import { GraphQLConfigService } from './config/apollo.config';

// Interceptor
import { NplModernizationInterceptor } from './interceptors/npl-modernization.interceptor';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    NplClientService,
    DeviceGraphQLService,
    RequestTransformerService,
    GraphQLConfigService,
    NplModernizationInterceptor,
    {
      provide: APOLLO_OPTIONS,
      useFactory: (httpLink: HttpLink) => {
        return {
          cache: new InMemoryCache({
            typePolicies: {
              Query: {
                fields: {
                  protocolStates: {
                    keyArgs: false,
                    merge(existing = { edges: [] }, incoming) {
                      return {
                        ...incoming,
                        edges: [...existing.edges, ...incoming.edges]
                      };
                    }
                  }
                }
              }
            }
          }),
          link: httpLink.create({
            uri: 'http://localhost:5555/graphql'
          }),
          defaultOptions: {
            watchQuery: {
              errorPolicy: 'all',
              fetchPolicy: 'cache-and-network'
            },
            query: {
              errorPolicy: 'all',
              fetchPolicy: 'network-only'
            }
          }
        };
      },
      deps: [HttpLink]
    }
  ]
})
export class NplModernizationModule {
  
  constructor(private graphqlConfig: GraphQLConfigService) {
    // Initialize Apollo with authentication
    this.graphqlConfig.initializeApollo().catch(error => {
      console.error('Failed to initialize Apollo:', error);
    });
  }
} 