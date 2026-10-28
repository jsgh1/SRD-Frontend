import React, {useEffect, useRef, useState} from 'react';
import {useSrdStyles, useSrdTheme, type SrdTheme} from './theme';
import {ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {ApiError, type GatewayClient, type TreasuryReceipt, type TreasurySummary} from './api';

const kindLabels: Record<TreasuryReceipt['kind'], string> = {opening: 'Apertura', income: 'Ingreso', expense: 'Egreso', reversal: 'Reverso'};
const showError = (cause: unknown) => cause instanceof Error ? cause.message : 'No se pudo cargar tesorería. Intenta de nuevo.';
const money = (value: string) => {
  const [whole, fraction = '00'] = value.split('.');
  if (!/^\d+$/.test(whole) || !/^\d{2}$/.test(fraction)) return `${value} COP`;
  return `$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction} COP`;
};

function Button({label, onPress, secondary = false, disabled = false}: {label: string; onPress: () => void; secondary?: boolean; disabled?: boolean}) {
  const styles = useSrdStyles(createStyles);
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function TreasuryScreen({client, onBack, onAuthExpired}: {client: GatewayClient; onBack: () => void; onAuthExpired: () => void}) {
  const theme = useSrdTheme();
  const styles = useSrdStyles(createStyles);
  const [data, setData] = useState<TreasurySummary | null>(null);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [filters, setFilters] = useState<{q?: string; from?: string; to?: string}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<TreasuryReceipt | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    client.treasury(page, filters).then(result => {if (active) setData(result);}).catch(cause => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onAuthExpired();
      else {setData(null); setError(showError(cause));}
    }).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [client, filters, onAuthExpired, page, refresh]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!selected && !detailBusy && !detailError) return false;
      generation.current++;
      setSelected(null); setSelectedId(''); setDetailBusy(false); setDetailError('');
      return true;
    });
    return () => subscription.remove();
  }, [detailBusy, detailError, selected]);

  async function openMovement(id: string) {
    const request = ++generation.current;
    setSelected(null); setSelectedId(id); setDetailError(''); setDetailBusy(true);
    try {
      const receipt = await client.treasuryMovement(id);
      if (request === generation.current) setSelected(receipt);
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) onAuthExpired();
      else setDetailError(showError(cause));
    } finally {if (request === generation.current) setDetailBusy(false);}
  }

  function closeMovement() {
    generation.current++;
    setSelected(null); setSelectedId(''); setDetailBusy(false); setDetailError('');
  }

  function applyFilters() {
    setPage(1);
    setFilters({q: queryInput.trim() || undefined, from: fromInput.trim() || undefined, to: toInput.trim() || undefined});
  }

  return <>
    <Text style={styles.eyebrow}>MOVIMIENTOS DE LA JUNTA</Text>
    <Text style={styles.title}>{selected ? `Comprobante ${selected.receipt}` : 'Tesorería'}</Text>
    <Text style={styles.lead}>{selected ? 'Detalle de un asiento confirmado.' : 'Consulta saldos y movimientos registrados.'}</Text>
    {!selected && !detailError && <>
      {data && <>
        {!data.opened && <View style={styles.notice}><Text style={styles.help}>La tesorería aún no tiene una apertura registrada.</Text></View>}
        <View style={styles.stats}>
          <Balance label="Saldo actual" value={data.balance} prominent />
          <Balance label="Saldo inicial" value={data.opening} />
          <Balance label="Ingresos" value={data.credits} />
          <Balance label="Egresos" value={data.debits} />
        </View>
        <Text style={styles.sectionTitle}>Historial · {data.total} movimientos</Text>
      </>}
      <View style={styles.card}>
        <Text style={styles.label}>Buscar por concepto o comprobante</Text>
        <TextInput accessibilityLabel="Buscar tesorería" value={queryInput} onChangeText={setQueryInput} onSubmitEditing={applyFilters} returnKeyType="search" maxLength={120} style={styles.input} placeholder="Concepto o TES-número" placeholderTextColor="#82979b" />
        <View style={styles.controls}>
          <View style={styles.dateField}><Text style={styles.label}>Desde</Text><TextInput accessibilityLabel="Fecha inicial de tesorería" value={fromInput} onChangeText={setFromInput} placeholder="AAAA-MM-DD" maxLength={10} style={styles.input} placeholderTextColor="#82979b" /></View>
          <View style={styles.dateField}><Text style={styles.label}>Hasta</Text><TextInput accessibilityLabel="Fecha final de tesorería" value={toInput} onChangeText={setToInput} placeholder="AAAA-MM-DD" maxLength={10} style={styles.input} placeholderTextColor="#82979b" /></View>
        </View>
        <View style={styles.controls}><Button label="Aplicar filtros" onPress={applyFilters} disabled={loading} /><Button label="Actualizar" onPress={() => setRefresh(value => value + 1)} secondary disabled={loading} /></View>
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator accessibilityLabel="Cargando tesorería" color={theme.colors.accent} />}
      {data && !loading && data.items.length === 0 && <View style={styles.card}><Text style={styles.help}>No hay movimientos que coincidan con la búsqueda.</Text></View>}
      {data?.items.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => {openMovement(item.id);}} style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>{item.receipt}</Text><Text style={[styles.amount, item.sign < 0 && styles.debit]}>{item.sign < 0 ? '−' : '+'}{money(item.amount)}</Text></View>
        <Text style={styles.help}>{item.effective_date} · {kindLabels[item.kind]}</Text>
        <Text style={styles.factValue}>{item.concept}</Text>
        <Text style={styles.help}>Saldo después: {money(item.balance_after)}</Text>
        <Text style={styles.link}>Ver detalle del movimiento</Text>
      </Pressable>)}
      {data && data.total > data.page_size && <View style={styles.pager}>
        <Button label="Anterior" secondary onPress={() => setPage(value => value - 1)} disabled={loading || page <= 1} />
        <Text style={styles.help}>Página {page} · {data.total} movimientos</Text>
        <Button label="Siguiente" secondary onPress={() => setPage(value => value + 1)} disabled={loading || page * data.page_size >= data.total} />
      </View>}
      <Button label="Volver al resumen" onPress={onBack} secondary />
    </>}
    {selected && <>
      <View style={styles.card}>
        <Fact label="Comprobante" value={selected.receipt} />
        <Fact label="Tipo" value={kindLabels[selected.kind]} />
        <Fact label="Importe" value={`${selected.sign < 0 ? '−' : '+'}${money(selected.amount)}`} />
        <Fact label="Concepto" value={selected.concept} />
        <Fact label="Fecha efectiva" value={selected.effective_date} />
        <Fact label="Responsable" value={selected.actor_name} />
        <Fact label="Saldo tras el asiento" value={money(selected.balance_after)} />
        <Fact label="Referencia de soporte" value={selected.support_note} />
        <Fact label="Revierte a" value={selected.reverses_id} />
        <Fact label="Revertido por" value={selected.reversed_by_id} />
      </View>
      <Button label="Volver al historial" onPress={closeMovement} secondary />
    </>}
    {detailBusy && <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.help}>Cargando comprobante…</Text></View>}
    {!!detailError && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{detailError}</Text><Button label="Reintentar" onPress={() => {if (selectedId) openMovement(selectedId);}} secondary /><Button label="Volver al historial" onPress={closeMovement} secondary /></View>}
  </>;
}

function Balance({label, value, prominent = false}: {label: string; value: string; prominent?: boolean}) {
  const styles = useSrdStyles(createStyles);
  return <View style={[styles.balance, prominent && styles.prominent]}><Text style={styles.balanceLabel}>{label}</Text><Text style={[styles.balanceValue, prominent && styles.prominentValue]}>{money(value)}</Text></View>;
}

function Fact({label, value}: {label: string; value?: string | null}) {
  const styles = useSrdStyles(createStyles);
  if (!value) return null;
  return <View style={styles.fact}><Text style={styles.label}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

const createStyles = (theme: SrdTheme) => StyleSheet.create({
  eyebrow: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 37},
  lead: {fontFamily: theme.typography.family, color: theme.colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8},
  sectionTitle: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 20, fontWeight: '800', marginTop: 4},
  card: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 17, borderRadius: theme.radius.card, gap: 9, elevation: theme.mode === 'dark' ? 0 : 1},
  label: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'}, cardTitle: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 17, fontWeight: '800'}, factValue: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 15},
  fact: {borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 8, gap: 3}, help: {fontFamily: theme.typography.family, color: theme.colors.muted, lineHeight: 20}, link: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800'},
  input: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontFamily: theme.typography.family, color: theme.colors.ink, backgroundColor: theme.colors.surface},
  controls: {flexDirection: 'row', alignItems: 'flex-end', gap: 8}, dateField: {flex: 1, gap: 6}, row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  amount: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', flexShrink: 1, textAlign: 'right'}, debit: {fontFamily: theme.typography.family, color: theme.colors.danger},
  stats: {flexDirection: 'row', flexWrap: 'wrap', gap: 9}, balance: {width: '48%', backgroundColor: theme.colors.surface, padding: 14, borderRadius: theme.radius.card, elevation: theme.mode === 'dark' ? 0 : 1, gap: 5},
  prominent: {width: '100%', backgroundColor: theme.colors.accentSoft}, balanceLabel: {fontFamily: theme.typography.family, color: theme.colors.muted, fontSize: 12, fontWeight: '700'}, balanceValue: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 18, fontWeight: '800'}, prominentValue: {fontFamily: theme.typography.family, color: theme.colors.accent, fontSize: 25},
  button: {backgroundColor: theme.colors.accent, paddingVertical: 12, paddingHorizontal: 12, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', minHeight: 44, flex: 1},
  secondary: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border}, buttonText: {fontFamily: theme.typography.family, color: '#fff', fontWeight: '700', textAlign: 'center'}, secondaryText: {fontFamily: theme.typography.family, color: theme.colors.ink}, disabled: {opacity: 0.55},
  pager: {flexDirection: 'row', alignItems: 'center', gap: 8}, error: {fontFamily: theme.typography.family, color: theme.colors.error, backgroundColor: theme.colors.errorSoft, borderWidth: 1, borderColor: theme.colors.errorBorder, padding: 12, borderRadius: 8},
  notice: {fontFamily: theme.typography.family, color: theme.colors.warning, backgroundColor: theme.colors.warningSoft, borderWidth: 1, borderColor: theme.colors.warningBorder, padding: 13, borderRadius: theme.radius.control}, loading: {alignItems: 'center', gap: 7, padding: 8},
});
