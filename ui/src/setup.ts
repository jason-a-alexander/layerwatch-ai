// The setup assistant's service: reads and writes LayerWatch AI's own instance
// through the core's resource routes, exactly as the extension settings
// screen does. Only a person allowed to configure extensions may write.
import type { ModuleHost } from '@prusa/connect-ui/slots';

const NAMESPACE = 'com.github.aux.leotrax3d.layerwatch-ai';

type Client = ModuleHost['client'];
type Listing = Awaited<ReturnType<Client['listResources']>>;
export type Instance = NonNullable<Listing['items']>[number];

interface SetupConfig {
  [key: string]: unknown;
  detector?: unknown;
  action?: unknown;
  obico_url?: unknown;
  obico_token?: unknown;
  frame_base_url?: unknown;
}

/** The options the assistant edits. A secret left empty keeps what is stored. */
export interface SetupValues {
  detector: string;
  action: string;
  obico_url: string;
  obico_token: string;
  frame_base_url: string;
}

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export const setupOn = (host: ModuleHost) => ({
  /** This module's instance, or undefined when the person may not read it. */
  read: async (signal?: AbortSignal): Promise<Instance | undefined> => {
    const listing = await host.client.listResources(
      { query: { kind: 'sink' } },
      signal,
    );
    return (listing.items ?? []).find((item) => item.namespace === NAMESPACE);
  },

  values: (instance: Instance): SetupValues => {
    const config = instance.config as SetupConfig;
    return {
      detector: text(config.detector) || 'auto',
      action: text(config.action) || 'notify',
      obico_url: text(config.obico_url),
      obico_token: '',
      frame_base_url: text(config.frame_base_url),
    };
  },

  /** Whether a token is stored; the server sends back only a marker. */
  hasToken: (instance: Instance): boolean =>
    text((instance.config as SetupConfig).obico_token) !== '',

  /** Writes the values, fenced by the version the form was read at. */
  write: async (
    instance: Instance,
    values: SetupValues,
    signal?: AbortSignal,
  ): Promise<unknown> => {
    const config: SetupConfig = {
      ...(instance.config as SetupConfig),
      detector: values.detector,
      action: values.action,
      obico_url: values.obico_url.trim(),
      frame_base_url: values.frame_base_url.trim(),
    };
    // The stored marker means "keep"; a typed token replaces it.
    if (values.obico_token !== '') config.obico_token = values.obico_token;

    return host.client.putResource(
      {
        path: {
          kind: instance.kind as 'sink',
          name: instance.name,
        },
        header: { 'If-Match': `"${instance.version}"` },
        body: {
          type: instance.type,
          enabled: instance.enabled,
          required: instance.required,
          config,
          hidden_contributions: instance.hidden_contributions ?? [],
          memory_mib: instance.memory_mib ?? 0,
          on_over_memory: instance.on_over_memory ?? 'stop',
          ...(instance.switch_off === undefined
            ? {}
            : { switch_off: instance.switch_off }),
        },
      },
      signal,
    );
  },
});

/**
 * Reads the setup code scripts/install-obico.sh prints: "pg1", the Obico
 * address and the frame address, separated by spaces. Undefined when it is
 * not one.
 */
export const readSetupCode = (
  code: string,
): Pick<SetupValues, 'obico_url' | 'frame_base_url'> | undefined => {
  const [tag, obico, frames] = code.trim().split(/\s+/);
  const web = /^https?:\/\/[^\s]+$/;
  if (tag !== 'pg1' || !obico || !frames) return undefined;
  if (!web.test(obico) || !web.test(frames)) return undefined;
  return { obico_url: obico, frame_base_url: frames };
};
