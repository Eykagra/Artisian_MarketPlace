import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string | null;
  sellerId: number;
  sellerEmail?: string;
  createdAt: string;
}

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products');
  return data;
}

export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export interface CreateProductPayload {
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string | null;
}

export async function createProduct(
  payload: CreateProductPayload,
  token: string
): Promise<Product> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const { data } = await api.post<Product>('/products', payload, { headers });
  return data;
}

export async function fetchMyProducts(token: string): Promise<Product[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const { data } = await api.get<Product[]>('/products/my', { headers });
  return data;
}

export interface UpdateProductPayload {
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string | null;
}

export async function updateProduct(
  id: number,
  payload: UpdateProductPayload,
  token: string
): Promise<Product> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const { data } = await api.put<Product>(`/products/${id}`, payload, { headers });
  return data;
}

export async function deleteProduct(id: number, token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };
  await api.delete(`/products/${id}`, { headers });
}

export async function uploadProductImage(file: File, token?: string): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Use axios.post directly so we don't send Content-Type: application/json (api instance default).
  // Axios will set multipart/form-data with boundary when body is FormData.
  const { data } = await axios.post<{ url: string }>(`${API_BASE}/upload/image`, form, {
    headers,
  });
  return data.url;
}

export interface ChatProduct {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
}

export interface ChatResponse {
  message: { id: number; userId: number | null; content: string; createdAt: string };
  ai: { text: string; product: ChatProduct | null };
  error?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatMessage(
  content: string,
  token?: string,
  history?: ChatHistoryEntry[]
): Promise<ChatResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const body = history?.length ? { content, history } : { content };
  const { data } = await api.post<ChatResponse>('/chat', body, { headers });
  return data;
}

export interface AuthResponse {
  user: { id: number; email: string; role: string };
  token: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function signup(email: string, password: string, role: 'buyer' | 'seller'): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', { email, password, role });
  return data;
}

export async function fetchMyOrders(token: string): Promise<Order[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const { data } = await api.get<Order[]>('/buyer/orders', { headers });
  return data;
}

export interface Order {
  id: number;
  productId: number;
  buyerId: number;
  quantity: number;
  totalPrice: number;
  status: string;
  buyerName: string;
  buyerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPincode: string;
  createdAt: string;
  productTitle?: string;
  productPrice?: number;
  productImageUrl?: string;
  buyerEmail?: string;
  sellerEmail?: string;
}

export interface SellerStats {
  totalOrders: number;
  totalRevenue: number;
  productsWithOrders: number;
  pendingOrders: number;
  completedOrders: number;
}

export interface PlaceOrderPayload {
  buyerName: string;
  buyerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPincode: string;
  quantity?: number;
}

export async function placeOrder(
  productId: number,
  payload: PlaceOrderPayload,
  token: string
): Promise<Order> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const { data } = await api.post<Order>(`/products/${productId}/orders`, payload, { headers });
  return data;
}

export async function fetchSellerOrders(token: string): Promise<Order[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const { data } = await api.get<Order[]>('/seller/orders', { headers });
  return data;
}

export async function fetchSellerStats(token: string): Promise<SellerStats> {
  const headers = { Authorization: `Bearer ${token}` };
  const { data } = await api.get<SellerStats>('/seller/stats', { headers });
  return data;
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
  token: string
): Promise<{ id: number; status: string }> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const { data } = await api.patch<{ id: number; status: string }>(
    `/orders/${orderId}/status`,
    { status },
    { headers }
  );
  return data;
}

function decodeToken(token: string | null | undefined): { userId?: number; role?: string } | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { userId?: number; role?: string };
  } catch {
    return null;
  }
}

export function getCurrentUserIdFromToken(token: string | null | undefined): number | null {
  const d = decodeToken(token);
  return typeof d?.userId === 'number' ? d.userId : null;
}

export function getRoleFromToken(token: string | null | undefined): 'buyer' | 'seller' | null {
  const d = decodeToken(token);
  if (d?.role === 'seller') return 'seller';
  if (d?.role === 'buyer') return 'buyer';
  return null;
}

export default api;
