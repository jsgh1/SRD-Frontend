import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {BackHandler, Text} from 'react-native';
import {InventoryScreen} from '../src/Inventory';
import {NetworkError, type Asset, type GatewayClient} from '../src/api';

function button(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const found = tree.root.findAll(node => node.props.accessibilityRole === 'button'
    && node.findAllByType(Text).some(text => text.props.children === label))[0];
  if (!found) throw new Error(`No se encontró el botón ${label}`);
  return found;
}

test('usa page_size del Backend para habilitar y cerrar la paginación de inventario', async () => {
  jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({remove: jest.fn()});
  const asset = (id: number): Asset => ({
    id: `123e4567-e89b-42d3-a456-${String(id).padStart(12, '0')}`,
    code: `P1-${id}`, type: 'movable', name: `Bien ${id}`, category: null, unit: 'unidad',
    description: null, location: 'Bodega de prueba', condition: 'Bueno', responsible_name: null,
    quantity: 1, status: 'active', version: 1, retired_at: null,
  });
  const assets = jest.fn(async (page: number) => ({
    items: page === 1 ? Array.from({length: 25}, (_, index) => asset(index + 1)) : [asset(26)],
    page, page_size: 25, total: 26,
  }));
  const client = {assets} as unknown as GatewayClient;
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<InventoryScreen client={client} onBack={jest.fn()} onAuthExpired={jest.fn()} />);
    await Promise.resolve();
  });

  expect(button(tree!, 'Siguiente').props.disabled).toBe(false);
  await ReactTestRenderer.act(async () => {
    button(tree!, 'Siguiente').props.onPress();
    await Promise.resolve();
  });

  expect(assets).toHaveBeenNthCalledWith(2, 2, {type: undefined, status: 'active', q: ''});
  expect(tree!.root.findAllByType(Text).some(text => Array.isArray(text.props.children)
    && text.props.children[0] === 'Página ' && text.props.children.includes(2)
    && text.props.children.includes(26) && text.props.children.includes(' bienes'))).toBe(true);
  expect(button(tree!, 'Siguiente').props.disabled).toBe(true);
  await ReactTestRenderer.act(async () => tree!.unmount());
});

test('muestra el error de red de inventario y permite recuperar la lista al actualizar', async () => {
  jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({remove: jest.fn()});
  const recoveredAsset: Asset = {
    id: '123e4567-e89b-42d3-a456-000000000099', code: 'P1-recovered', type: 'movable', name: 'Bien recuperado',
    category: null, unit: 'unidad', description: null, location: 'Bodega de prueba', condition: 'Bueno',
    responsible_name: null, quantity: 1, status: 'active', version: 1, retired_at: null,
  };
  const assets = jest.fn()
    .mockRejectedValueOnce(new NetworkError('assets', 'No hay conexión con el servidor. Comprueba su dirección y tu red.'))
    .mockResolvedValueOnce({items: [recoveredAsset], page: 1, page_size: 25, total: 1});
  const client = {assets} as unknown as GatewayClient;
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<InventoryScreen client={client} onBack={jest.fn()} onAuthExpired={jest.fn()} />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(tree!.root.findAll(node => node.props.accessibilityRole === 'alert')
    .some(alert => alert.props.children === 'No hay conexión con el servidor. Comprueba su dirección y tu red.')).toBe(true);
  await ReactTestRenderer.act(async () => {
    button(tree!, 'Actualizar').props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(assets).toHaveBeenCalledTimes(2);
  expect(tree!.root.findAllByType(Text).some(text => text.props.children === 'Bien recuperado')).toBe(true);
  expect(tree!.root.findAll(node => node.props.accessibilityRole === 'alert')).toHaveLength(0);
  await ReactTestRenderer.act(async () => tree!.unmount());
});
