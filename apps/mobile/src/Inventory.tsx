import React, {useEffect, useRef, useState} from 'react';
import {useSrdStyles, useSrdTheme, type SrdTheme} from './theme';
import {ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {ApiError, type Asset, type AssetDetail, type AssetMovement, type GatewayClient} from './api';

type Filters = {type?: AssetMovement['type']; q?: string; from?: string; to?: string};
const movementLabels: Record<AssetMovement['type'], string> = {opening: 'Registro inicial', in: 'Entrada', out: 'Salida', adjust: 'Ajuste', retire: 'Baja'};
const assetType = (type: Asset['type']) => type === 'real_estate' ? 'Inmueble' : 'Mueble';
const showError = (cause: unknown) => cause instanceof Error ? cause.message : 'No se pudo cargar el inventario. Intenta de nuevo.';

function Button({label, onPress, secondary = false, disabled = false}: {label: string; onPress: () => void; secondary?: boolean; disabled?: boolean}) {
  const styles = useSrdStyles(createStyles);
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

function Chip({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) {
  const styles = useSrdStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

export function InventoryScreen({client, onBack, onAuthExpired}: {client: GatewayClient; onBack: () => void; onAuthExpired: () => void}) {
  const theme = useSrdTheme();
  const styles = useSrdStyles(createStyles);
  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'' | Asset['type']>('');
  const [status, setStatus] = useState<Asset['status']>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [failedAssetId, setFailedAssetId] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [historyDraft, setHistoryDraft] = useState<Filters>({});
  const [historyFilters, setHistoryFilters] = useState<Filters>({});
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    client.assets(page, {type: type || undefined, status, q: query}).then(result => {
      if (active) {setItems(result.items); setTotal(result.total); setPageSize(result.page_size);}
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onAuthExpired();
      else {setItems([]); setTotal(0); setError(showError(cause));}
    }).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [client, onAuthExpired, page, query, refresh, status, type]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!detail && !detailBusy && !detailError) return false;
      generation.current++;
      setDetail(null); setDetailBusy(false); setDetailError(''); setHistoryError(''); setFailedAssetId('');
      return true;
    });
    return () => subscription.remove();
  }, [detail, detailBusy, detailError]);

  async function openAsset(id: string) {
    const request = ++generation.current;
    setDetail(null); setFailedAssetId(id); setDetailError(''); setDetailBusy(true); setHistoryDraft({}); setHistoryFilters({});
    try {
      const result = await client.asset(id);
      if (request === generation.current) {setDetail(result); setFailedAssetId('');}
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) onAuthExpired();
      else setDetailError(showError(cause));
    } finally {if (request === generation.current) setDetailBusy(false);}
  }

  async function loadHistory(nextPage: number, filters = historyFilters) {
    if (!detail) return;
    const id = detail.asset.id;
    const request = ++generation.current;
    setHistoryBusy(true); setHistoryError('');
    try {
      const result = await client.asset(id, nextPage, filters);
      if (request === generation.current) {setDetail(result); setHistoryFilters(filters);}
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) onAuthExpired();
      else setHistoryError(showError(cause));
    } finally {if (request === generation.current) setHistoryBusy(false);}
  }

  function backFromDetail() {
    generation.current++;
    setDetail(null); setDetailBusy(false); setDetailError(''); setHistoryError(''); setFailedAssetId('');
  }

  return <>
    <Text style={styles.eyebrow}>GESTIÓN DE BIENES</Text>
    <Text style={styles.title}>{detail ? detail.asset.name : 'Inventario'}</Text>
    <Text style={styles.lead}>{detail ? `${detail.asset.code} · ${assetType(detail.asset.type)}` : 'Consulta los bienes y su historial de movimientos.'}</Text>
    {detail ? <>
      <View style={styles.card}>
        <Fact label="Código" value={detail.asset.code} />
        <Fact label="Tipo" value={assetType(detail.asset.type)} />
        <Fact label="Categoría" value={detail.asset.category} />
        <Fact label="Existencia actual" value={`${detail.asset.quantity} ${detail.asset.unit || ''}`.trim()} />
        <Fact label="Estado" value={detail.asset.status === 'active' ? 'Activo' : 'Dado de baja'} />
        <Fact label="Ubicación" value={detail.asset.location} />
        <Fact label="Condición" value={detail.asset.condition} />
        <Fact label="Responsable" value={detail.asset.responsible_name} />
        <Fact label="Descripción" value={detail.asset.description} />
      </View>
      <Text style={styles.sectionTitle}>Historial de movimientos · {detail.movement_total}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Filtrar historial por operación</Text>
        <View style={styles.chips}>
          <Chip label="Todas" selected={!historyDraft.type} onPress={() => setHistoryDraft(value => ({...value, type: undefined}))} />
          {(Object.keys(movementLabels) as AssetMovement['type'][]).map(value => <Chip key={value} label={movementLabels[value]} selected={historyDraft.type === value} onPress={() => setHistoryDraft(current => ({...current, type: value}))} />)}
        </View>
        <Text style={styles.label}>Motivo</Text>
        <TextInput accessibilityLabel="Buscar motivo del movimiento" value={historyDraft.q ?? ''} onChangeText={value => setHistoryDraft(current => ({...current, q: value}))} maxLength={120} style={styles.input} placeholder="Buscar en los motivos" placeholderTextColor={theme.colors.placeholder} />
        <View style={styles.controls}>
        <View style={styles.dateField}><Text style={styles.label}>Desde</Text><TextInput accessibilityLabel="Fecha inicial del historial" value={historyDraft.from ?? ''} onChangeText={value => setHistoryDraft(current => ({...current, from: value}))} placeholder="AAAA-MM-DD" maxLength={10} style={styles.input} placeholderTextColor={theme.colors.placeholder} /></View>
        <View style={styles.dateField}><Text style={styles.label}>Hasta</Text><TextInput accessibilityLabel="Fecha final del historial" value={historyDraft.to ?? ''} onChangeText={value => setHistoryDraft(current => ({...current, to: value}))} placeholder="AAAA-MM-DD" maxLength={10} style={styles.input} placeholderTextColor={theme.colors.placeholder} /></View>
        </View>
        <Button label="Aplicar filtros" onPress={() => {loadHistory(1, {...historyDraft});}} disabled={historyBusy} />
        <Text style={styles.help}>Las fechas usan el calendario de Colombia. La ficha conserva la existencia actual.</Text>
      </View>
      {!!historyError && <Text accessibilityRole="alert" style={styles.error}>{historyError}</Text>}
      {historyBusy && <ActivityIndicator color={theme.colors.accent} />}
      {!historyBusy && detail.movements.length === 0 && <View style={styles.card}><Text style={styles.help}>No hay movimientos que coincidan con los filtros.</Text></View>}
      {detail.movements.map(move => <MovementCard key={move.id} movement={move} />)}
      {detail.movement_total > detail.movement_page_size && <View style={styles.pager}>
        <Button label="Más recientes" secondary onPress={() => {loadHistory(detail.movement_page - 1);}} disabled={historyBusy || detail.movement_page <= 1} />
        <Text style={styles.help}>Página {detail.movement_page}</Text>
        <Button label="Más antiguos" secondary onPress={() => {loadHistory(detail.movement_page + 1);}} disabled={historyBusy || detail.movement_page * detail.movement_page_size >= detail.movement_total} />
      </View>}
      <Button label="Volver al inventario" onPress={backFromDetail} secondary />
    </> : detailError ? <View style={styles.card}>
      <Text accessibilityRole="alert" style={styles.error}>{detailError}</Text>
      <Button label="Reintentar" onPress={() => {if (failedAssetId) openAsset(failedAssetId);}} secondary />
      <Button label="Volver al inventario" onPress={backFromDetail} secondary />
    </View> : <>
      <View style={styles.card}>
        <Text style={styles.label}>Buscar por código o nombre</Text>
        <TextInput accessibilityLabel="Buscar inventario" value={queryInput} onChangeText={setQueryInput} onSubmitEditing={() => {setPage(1); setQuery(queryInput.trim());}} returnKeyType="search" maxLength={120} style={styles.input} placeholder="Código o nombre del bien" placeholderTextColor={theme.colors.placeholder} />
        <View style={styles.controls}><Button label="Buscar" onPress={() => {setPage(1); setQuery(queryInput.trim());}} /><Button label="Actualizar" onPress={() => setRefresh(value => value + 1)} secondary disabled={loading} /></View>
        <Text style={styles.label}>Tipo de bien</Text>
        <View style={styles.chips}>
          <Chip label="Todos" selected={!type} onPress={() => {setType(''); setPage(1);}} />
          <Chip label="Inmuebles" selected={type === 'real_estate'} onPress={() => {setType('real_estate'); setPage(1);}} />
          <Chip label="Muebles" selected={type === 'movable'} onPress={() => {setType('movable'); setPage(1);}} />
        </View>
        <View style={styles.chips}>
          <Chip label="Activos" selected={status === 'active'} onPress={() => {setStatus('active'); setPage(1);}} />
          <Chip label="Dados de baja" selected={status === 'retired'} onPress={() => {setStatus('retired'); setPage(1);}} />
        </View>
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator accessibilityLabel="Cargando inventario" color={theme.colors.accent} />}
      {!loading && !error && items.length === 0 && <View style={styles.card}><Text style={styles.help}>No hay bienes que coincidan con la búsqueda.</Text></View>}
      {items.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => {openAsset(item.id);}} style={styles.card}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.help}>{item.code} · {assetType(item.type)} · {item.status === 'active' ? 'Activo' : 'Dado de baja'}</Text>
        <Text style={styles.factValue}>Existencia: {item.quantity} {item.unit || ''}</Text>
        {!!item.location && <Text style={styles.help}>{item.location}</Text>}
        <Text style={styles.link}>Ver ficha e historial</Text>
      </Pressable>)}
      {total > 0 && <View style={styles.pager}>
        <Button label="Anterior" secondary onPress={() => setPage(value => value - 1)} disabled={loading || page <= 1} />
        <Text style={styles.help}>Página {page} · {total} bienes</Text>
        <Button label="Siguiente" secondary onPress={() => setPage(value => value + 1)} disabled={loading || page * pageSize >= total} />
      </View>}
      <Button label="Volver al resumen" onPress={onBack} secondary />
    </>}
    {detailBusy && <View style={styles.loadingOverlay}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.help}>Cargando ficha…</Text></View>}
  </>;
}

function Fact({label, value}: {label: string; value?: string | number | null}) {
  const styles = useSrdStyles(createStyles);
  if (value === null || value === undefined || value === '') return null;
  return <View style={styles.fact}><Text style={styles.label}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

function MovementCard({movement}: {movement: AssetMovement}) {
  const styles = useSrdStyles(createStyles);
  return <View style={styles.card}>
    <Text style={styles.cardTitle}>{movementLabels[movement.type]} · #{movement.sequence}</Text>
    <Fact label="Registrado" value={movement.created_at} />
    <Fact label="Cambio" value={`${movement.delta > 0 ? '+' : ''}${movement.delta}`} />
    <Fact label="Existencia resultante" value={movement.quantity_after} />
    <Fact label="Motivo" value={movement.reason} />
    <Fact label="Responsable" value={movement.performer_name} />
  </View>;
}

const createStyles = (theme: SrdTheme) => StyleSheet.create({
  eyebrow: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 37},
  lead: {fontFamily: theme.typography.family, color: theme.colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8},
  sectionTitle: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 20, fontWeight: '800', marginTop: 4},
  card: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 17, borderRadius: theme.radius.card, gap: 10, elevation: theme.mode === 'dark' ? 0 : 1},
  cardTitle: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 17, fontWeight: '800'},
  label: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'}, factValue: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 15},
  fact: {borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 8, gap: 3},
  help: {fontFamily: theme.typography.family, color: theme.colors.muted, lineHeight: 20}, link: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800'},
  input: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontFamily: theme.typography.family, color: theme.colors.ink, backgroundColor: theme.colors.surface},
  controls: {flexDirection: 'row', alignItems: 'flex-end', gap: 8}, dateField: {flex: 1, gap: 6},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 7},
  chip: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44, justifyContent: 'center'},
  chipSelected: {backgroundColor: theme.colors.accent, borderColor: theme.colors.accent}, chipText: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 12}, chipTextSelected: {fontFamily: theme.typography.family, color: '#fff', fontWeight: '700'},
  button: {backgroundColor: theme.colors.accent, paddingVertical: 12, paddingHorizontal: 12, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', minHeight: 44, flex: 1},
  secondary: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border}, buttonText: {fontFamily: theme.typography.family, color: '#fff', fontWeight: '700', textAlign: 'center'}, secondaryText: {fontFamily: theme.typography.family, color: theme.colors.ink}, disabled: {opacity: 0.55},
  pager: {flexDirection: 'row', alignItems: 'center', gap: 8}, error: {fontFamily: theme.typography.family, color: theme.colors.error, backgroundColor: theme.colors.errorSoft, borderWidth: 1, borderColor: theme.colors.errorBorder, padding: 12, borderRadius: 8},
  loadingOverlay: {alignItems: 'center', gap: 7, padding: 8},
});
