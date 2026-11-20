// The service layer: LayerWatch AI's own routes, and the two core routes the
// page draws pictures from, all through the client the host handed over.
import type { ModuleHost } from '@prusa/connect-ui/slots';
import { bind, type components } from 'layerwatch-ai-client';

export type Status = components['schemas']['Status'];
export type Watch = components['schemas']['Watch'];
export type Incident = components['schemas']['Incident'];
export type Box = components['schemas']['Box'];
export type Check = components['schemas']['Check'];
export type Test = components['schemas']['Test'];

export const guardOn = (host: ModuleHost) => {
  const routes = bind(host.client);

  /** An object URL for a response's body, or undefined when it has none. */
  const picture = async (
    answer: Promise<Response>,
  ): Promise<string | undefined> => {
    const response = await answer;
    if (!response.ok) return undefined;

    return URL.createObjectURL(await response.blob());
  };

  return {
    status: (signal?: AbortSignal): Promise<Status> =>
      routes.readStatus({}, signal),
    incidents: async (signal?: AbortSignal): Promise<Incident[]> =>
      (await routes.listIncidents({}, signal)).incidents,
    check: (signal?: AbortSignal): Promise<Check> =>
      routes.checkDetector({}, signal),
    test: (printer: string, signal?: AbortSignal): Promise<Test> =>
      routes.testPrinter({ path: { printer } }, signal),
    reset: (printer: string, signal?: AbortSignal): Promise<unknown> =>
      routes.resetPrinter({ path: { printer } }, signal),
    /** The camera's newest still. */
    snapshot: (camera: string, signal?: AbortSignal) =>
      picture(host.client.getCameraSnapshot({ path: { camera } }, signal)),
    /** The frame an incident was judged on, from the storage the camera wrote it to. */
    frame: (incident: Incident, signal?: AbortSignal) =>
      picture(
        host.client.downloadStorageObject(
          {
            path: { storage: incident.storage },
            query: { path: incident.path },
          },
          signal,
        ),
      ),
  };
};
