<script lang="ts">
  import { describeFault, type FaultText } from '@prusa/connect-ui/i18n';
  import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    FaultAlert,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@prusa/connect-ui/primitives';

  import { guardOn, type Check } from './guard';
  import { heldHost } from './host';
  import {
    readSetupCode,
    setupOn,
    type Instance,
    type SetupValues,
  } from './setup';

  let { onsaved }: { onsaved?: () => void } = $props();

  const host = heldHost();
  const t = host.t;
  const guard = guardOn(host);
  const setup = setupOn(host);

  let instance = $state<Instance | undefined>();
  let values = $state<SetupValues | undefined>();
  let readable = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let fault = $state<FaultText | undefined>();
  let checked = $state<Check | undefined>();
  let codeBad = $state(false);

  const pasted = (e: Event) => {
    const code = (e.currentTarget as HTMLInputElement).value;
    if (code.trim() === '' || !values) {
      codeBad = false;
      return;
    }
    const read = readSetupCode(code);
    codeBad = read === undefined;
    if (read) {
      values.detector = 'obico';
      values.obico_url = read.obico_url;
      values.frame_base_url = read.frame_base_url;
    }
  };

  const load = async () => {
    try {
      instance = await setup.read(host.signal);
      readable = instance !== undefined;
      values = instance ? setup.values(instance) : undefined;
    } catch {
      readable = false;
    }
  };

  const save = async () => {
    if (!instance || !values) return;
    saving = true;
    saved = false;
    fault = undefined;
    checked = undefined;
    try {
      await setup.write(instance, values, host.signal);
      saved = true;
      await load();
      // The host restarts the module with the new config; give it a moment.
      await new Promise((done) => setTimeout(done, 1500));
      checked = await guard.check(host.signal);
      onsaved?.();
    } catch (thrown: unknown) {
      if (!host.signal.aborted) fault = describeFault(thrown);
    } finally {
      saving = false;
    }
  };

  $effect(() => {
    void load();
  });

  const detectors = $derived([
    { value: 'auto', label: t('guard.setup.detector.auto') },
    { value: 'heuristic', label: t('guard.detector.heuristic') },
    { value: 'obico', label: t('guard.detector.obico') },
  ]);
  const actions = $derived([
    { value: 'notify', label: t('guard.action.notify') },
    { value: 'pause', label: t('guard.action.pause') },
  ]);

  const typed =
    (key: 'obico_url' | 'obico_token' | 'frame_base_url') => (e: Event) => {
      if (values) values[key] = (e.currentTarget as HTMLInputElement).value;
    };
</script>

{#if readable && values}
  <Card>
    <CardHeader>
      <CardTitle>{t('guard.setup.title')}</CardTitle>
    </CardHeader>
    <CardContent>
      <form
        class="flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p class="text-sm text-muted-foreground">{t('guard.setup.intro')}</p>

        {#snippet choice(
          id: string,
          labelKey: string,
          items: { value: string; label: string }[],
          key: 'detector' | 'action',
        )}
          <div class="flex flex-col gap-1">
            <Label for={id}>{t(labelKey)}</Label>
            {#if values}
              <Select
                {items}
                value={values[key]}
                onValueChange={(next: string) => {
                  if (values) values[key] = next;
                }}
              >
                <SelectTrigger {id} class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {#each items as item (item.value)}
                    <SelectItem value={item.value} label={item.label}
                      >{item.label}</SelectItem
                    >
                  {/each}
                </SelectContent>
              </Select>
            {/if}
          </div>
        {/snippet}

        {#snippet text(
          id: string,
          labelKey: string,
          key: 'obico_url' | 'obico_token' | 'frame_base_url',
          type: string,
          placeholder: string,
        )}
          <div class="flex flex-col gap-1">
            <Label for={id}>{t(labelKey)}</Label>
            <Input
              {id}
              {type}
              {placeholder}
              autocomplete="off"
              value={values?.[key] ?? ''}
              oninput={typed(key)}
            />
          </div>
        {/snippet}

        <div class="flex flex-col gap-1">
          <Label for="pg-code">{t('guard.setup.code')}</Label>
          <Input id="pg-code" autocomplete="off" oninput={pasted} />
          <p class="text-sm text-muted-foreground">
            {codeBad ? t('guard.setup.code.bad') : t('guard.setup.code.help')}
          </p>
        </div>

        {@render choice(
          'pg-detector',
          'guard.setup.detector',
          detectors,
          'detector',
        )}

        {#if values.detector !== 'heuristic'}
          {@render text(
            'pg-url',
            'guard.setup.obicoUrl',
            'obico_url',
            'url',
            t('guard.setup.obicoUrl.example'),
          )}
          {@render text(
            'pg-token',
            'guard.setup.obicoToken',
            'obico_token',
            'password',
            instance && setup.hasToken(instance)
              ? t('guard.setup.tokenKept')
              : '',
          )}
          {@render text(
            'pg-frames',
            'guard.setup.frameBase',
            'frame_base_url',
            'url',
            t('guard.setup.frameBase.example'),
          )}
          <p class="text-sm text-muted-foreground">
            {t('guard.setup.frameBase.help')}
          </p>
        {/if}

        {@render choice('pg-action', 'guard.setup.action', actions, 'action')}

        {#if fault}
          <FaultAlert {fault} />
        {/if}

        <div class="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {t('guard.setup.save')}
          </Button>
          {#if saved}
            <span class="text-sm text-muted-foreground"
              >{t('guard.setup.saved')}</span
            >
          {/if}
          {#if checked}
            {#if checked.reachable}
              <Badge variant="success"
                >{t('guard.health.reachable', {
                  millis: checked.millis,
                })}</Badge
              >
            {:else}
              <Badge variant="destructive"
                >{t('guard.health.unreachable')}</Badge
              >
              <span class="text-sm text-destructive">{checked.problem}</span>
            {/if}
          {/if}
        </div>
      </form>
    </CardContent>
  </Card>
{/if}
