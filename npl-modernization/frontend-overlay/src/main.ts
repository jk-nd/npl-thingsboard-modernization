import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { OverlayModule } from './app/overlay.module';

(window as any).nplOverlayBootstrap = (rootInjector: any) => {
  platformBrowserDynamic([{ provide: 'TB_ROOT_INJECTOR', useValue: rootInjector }])
    .bootstrapModule(OverlayModule)
    .catch(err => console.error(err));
};

// Wait for ThingsBoard root injector when running standalone (dev)
if ((window as any).ng && (document.querySelector('tb-root, app-root'))) {
  platformBrowserDynamic().bootstrapModule(OverlayModule);
}
