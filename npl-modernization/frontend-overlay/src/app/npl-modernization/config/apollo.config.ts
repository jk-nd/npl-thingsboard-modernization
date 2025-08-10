import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloClientOptions } from '@apollo/client/core';
import { HttpClient } from '@angular/common/http';
import { setContext } from '@apollo/client/link/context';

@Injectable({
  providedIn: 'root'
})
export class GraphQLConfigService {
  private readonly READ_MODEL_URL = '/api/graphql';
  private readonly OIDC_PROXY_URL = 'http://localhost:8080';

  constructor(
    private apollo: Apollo,
    private httpLink: HttpLink,
    private http: HttpClient
  ) {}

  /**
   * Get authentication token for GraphQL requests
   */
  private async getAuthToken(): Promise<string> {
    const authRequest = {
      username: 'tenant@thingsboard.org',
      password: 'tenant'
    };

    try {
      const response = await this.http.post<{ access_token: string }>(
        `${this.OIDC_PROXY_URL}/protocol/openid-connect/token`,
        authRequest
      ).toPromise();
      
      return response?.access_token || '';
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return '';
    }
  }

  /**
   * Initialize Apollo Client with authentication
   */
  async initializeApollo(): Promise<void> {
    // Create HTTP link to GraphQL endpoint
    const httpLinkInstance = this.httpLink.create({
      uri: this.READ_MODEL_URL
    });

    // Create auth link that adds Bearer token to requests
    const authLink = setContext(async (_, { headers }) => {
      const token = await this.getAuthToken();
      
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : "",
        }
      };
    });

    // Create Apollo Client
    this.apollo.create({
      link: authLink.concat(httpLinkInstance),
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
    });
  }

  /**
   * Get Apollo instance (call after initialization)
   */
  getApollo(): Apollo {
    return this.apollo;
  }
} 