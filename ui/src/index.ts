// The bundle's entry: one page, LayerWatch AI, in the Connect sidebar.
import { defineModule } from '@prusa/connect-ui/slots';

import { holdHost } from './host';
import Page from './page.svelte';
import './styles.css';

export default defineModule((host) => {
  holdHost(host);
  host.register.page('layerwatch-ai', Page);
});
