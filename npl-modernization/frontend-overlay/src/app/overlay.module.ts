import { NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ApolloModule, APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client/core';

import { NplModernizationInterceptor } from './npl-modernization/interceptors/npl-modernization.interceptor';
import { GraphQLConfigService } from './npl-modernization/config/apollo.config';

@NgModule({
  imports: [HttpClientModule, ApolloModule],
  providers: [
    GraphQLConfigService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: NplModernizationInterceptor,
      multi: true
    },
    {
      provide: APOLLO_OPTIONS,
      deps: [HttpLink],
      useFactory: (httpLink: HttpLink) => ({
        cache: new InMemoryCache(),
        link : httpLink.create({ uri: 'http://localhost:5555/graphql' })
      })
    }
  ]
})
export class OverlayModule {} 