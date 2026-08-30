'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface Variant {
  id?: string;
  color: string;
  size: string;
  stock_quantity: number;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price?: number | null;
  is_available: boolean;
  sales_count?: number;
  total_stock?: number;
  product_images?: { id?: string; image_url: string }[];
  product_variants?: Variant[];
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: number;
  products?: { title: string };
  product_variants?: { color: string; size: string };
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  maps_link: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  order_items?: OrderItem[];
}

const ADMIN_PASSWORD = 'admin';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // التبويبات
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'settings'>('products');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // إعدادات نص البث المباشر
  const [liveStreamText, setLiveStreamText] = useState('بث مباشر كل 3 أيام');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // حالات البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'top_sales' | 'low_sales' | 'available' | 'disabled' | 'low_stock'>('all');

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // حقول نموذج المنتج
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variantsList, setVariantsList] = useState<{ color: string; stock: number }[]>([
    { color: 'أسود', stock: 10 },
  ]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, address, maps_link, notes, total_amount, created_at,
        order_items (
          id, quantity, price_at_purchase,
          products (title),
          product_variants (color, size)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as unknown as Order[]);
    }
    setLoadingOrders(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'live_stream_text')
      .single();

    if (data?.value) {
      setLiveStreamText(data.value);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    const { error } = await supabase
      .from('store_settings')
      .upsert({ key: 'live_stream_text', value: liveStreamText });

    setSavingSettings(false);
    if (!error) {
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 3000);
    } else {
      alert('تعذر حفظ النص، يرجى المحاولة لاحقاً');
    }
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    const { data: prods, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity');

    const salesMap: Record<string, number> = {};
    (orderItems || []).forEach((item) => {
      if (item.product_id) {
        salesMap[item.product_id] = (salesMap[item.product_id] || 0) + (item.quantity || 1);
      }
    });

    if (!prodErr && prods) {
      const fullProducts = await Promise.all(
        prods.map(async (p) => {
          const { data: images } = await supabase
            .from('product_images')
            .select('id, image_url')
            .eq('product_id', p.id);

          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, color, size, stock_quantity')
            .eq('product_id', p.id);

          const totalStock = (variants || []).reduce((sum, v) => sum + (v.stock_quantity || 0), 0);

          return {
            ...p,
            sales_count: salesMap[p.id] || 0,
            total_stock: totalStock,
            product_images: images || [],
            product_variants: variants || [],
          };
        })
      );
      setProducts(fullProducts as Product[]);
    }
    setLoadingProducts(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchOrders();
    fetchProducts();
    fetchSettings();

    const channel = supabase
      .channel('realtime_admin_sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          playNotificationSound();
          const newOrder = payload.new as { customer_name?: string; total_amount?: number };
          setNewOrderAlert(`طلب وارد جديد: ${newOrder.customer_name || 'عميل'} ($${newOrder.total_amount || 0})`);
          setTimeout(() => setNewOrderAlert(null), 6000);
          fetchOrders();
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
      setAuthError(false);
    } else {
      setAuthError(true);
      setPinInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_auth');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      setUploadingImage(true);

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) {
        alert('حدث خطأ أثناء رفع الصورة: تأكد من إنشاء الـ Bucket باسم products');
        setUploadingImage(false);
        return;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
    } catch (err) {
      console.error(err);
      alert('تعذر رفع الملف');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddVariant = () => {
    setVariantsList((prev) => [...prev, { color: '', stock: 10 }]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variantsList.length <= 1) return;
    setVariantsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: 'color' | 'stock', value: string) => {
    setVariantsList((prev) => {
      const updated = [...prev];
      if (field === 'color') {
        updated[index].color = value;
      } else {
        updated[index].stock = parseInt(value) || 0;
      }
      return updated;
    });
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingProductId(null);
    setTitle('');
    setDesc('');
    setPrice('');
    setOriginalPrice('');
    setImageUrl('');
    setVariantsList([{ color: 'أسود', stock: 10 }]);
    setShowModal(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setIsEditing(true);
    setEditingProductId(product.id);
    setTitle(product.title);
    setDesc(product.description || '');
    setPrice(product.price.toString());
    setOriginalPrice(product.original_price ? product.original_price.toString() : '');
    setImageUrl(product.product_images?.[0]?.image_url || '');

    if (product.product_variants && product.product_variants.length > 0) {
      setVariantsList(
        product.product_variants.map((v) => ({
          color: v.color,
          stock: v.stock_quantity,
        }))
      );
    } else {
      setVariantsList([{ color: 'افتراضي', stock: 10 }]);
    }

    setShowModal(true);
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('هل تريد إنهاء وأرشفة هذا الطلب؟')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    const nextStatus = !product.is_available;
    const { error } = await supabase
      .from('products')
      .update({ is_available: nextStatus })
      .eq('id', product.id);

    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: nextStatus } : p))
      );
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProduct(true);

    const validVariants = variantsList.filter((v) => v.color.trim() !== '');
    if (validVariants.length === 0) {
      validVariants.push({ color: 'افتراضي', stock: 10 });
    }

    const payload = {
      title: title,
      description: desc,
      price: parseFloat(price) || 0,
      original_price: originalPrice ? parseFloat(originalPrice) : null,
    };

    if (isEditing && editingProductId) {
      const { error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProductId);

      if (updateError) {
        alert('حدث خطأ أثناء تعديل بيانات المنتج');
        setSubmittingProduct(false);
        return;
      }

      if (imageUrl) {
        await supabase.from('product_images').delete().eq('product_id', editingProductId);
        await supabase.from('product_images').insert([
          { product_id: editingProductId, image_url: imageUrl, is_main: true },
        ]);
      }

      await supabase.from('product_variants').delete().eq('product_id', editingProductId);
      const variantsToInsert = validVariants.map((v) => ({
        product_id: editingProductId,
        color: v.color,
        size: 'Standard',
        stock_quantity: v.stock,
      }));
      await supabase.from('product_variants').insert(variantsToInsert);

    } else {
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .insert([
          {
            ...payload,
            is_available: true,
          },
        ])
        .select()
        .single();

      if (prodError || !prodData) {
        alert('خطأ أثناء إضافة المنتج');
        setSubmittingProduct(false);
        return;
      }

      if (imageUrl) {
        await supabase.from('product_images').insert([
          { product_id: prodData.id, image_url: imageUrl, is_main: true },
        ]);
      }

      const variantsToInsert = validVariants.map((v) => ({
        product_id: prodData.id,
        color: v.color,
        size: 'Standard',
        stock_quantity: v.stock,
      }));
      await supabase.from('product_variants').insert(variantsToInsert);
    }

    setSubmittingProduct(false);
    setShowModal(false);
    fetchProducts();
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }

    switch (productFilter) {
      case 'top_sales':
        list.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
        break;
      case 'low_sales':
        list.sort((a, b) => (a.sales_count || 0) - (b.sales_count || 0));
        break;
      case 'available':
        list = list.filter((p) => p.is_available);
        break;
      case 'disabled':
        list = list.filter((p) => !p.is_available);
        break;
      case 'low_stock':
        list = list.filter((p) => (p.total_stock || 0) <= 5);
        break;
      default:
        break;
    }

    return list;
  }, [products, searchQuery, productFilter]);

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 text-zinc-800" dir="rtl">
        <div className="bg-white/80 backdrop-blur-xl w-full max-w-sm rounded-[28px] p-8 border border-zinc-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-6">
          <div className="w-13 h-13 bg-zinc-900 text-white rounded-2xl flex items-center justify-center mx-auto text-xl shadow-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">لوحة تحكم المتجر</h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">أدخل رمز المرور للوصول الآمن</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••••"
                className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-lg font-bold text-zinc-900 tracking-widest placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 focus:bg-white transition duration-200"
              />
              {authError && (
                <p className="text-xs text-rose-500 font-bold mt-2">رمز المرور غير صحيح</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-3.5 rounded-2xl transition duration-200 active:scale-[0.98] shadow-sm"
            >
              دخول الإدارة
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row text-zinc-800 font-sans relative antialiased" dir="rtl">

      {/* شريط الإشعار الفوري للطلبات الجديدة */}
      {newOrderAlert && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/90 backdrop-blur-md text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 animate-in fade-in slide-in-from-top duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold tracking-wide">{newOrderAlert}</span>
        </div>
      )}

      {/* Sidebar العصري */}
      <aside className="w-full md:w-64 bg-white border-l border-zinc-200/80 p-5 flex flex-col justify-between shrink-0">
        <div>
          {/* أيقونة المتجر باللون الأسود الكلاسيكي */}
          <div className="flex items-center gap-3 mb-8 px-1">
            <div className="w-9 h-9 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-black text-base shadow-sm">
              ت
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-zinc-900 tracking-tight leading-none">متجر التحرير</h2>
              <span className="text-[10px] font-semibold text-zinc-400 mt-1 block">لوحة الإدارة</span>
            </div>
          </div>

          {/* التبويبات */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                activeTab === 'orders'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>الطلبات الواردة</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                activeTab === 'products'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>إدارة المنتجات</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                activeTab === 'settings'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>الإعدادات</span>
              </div>
            </button>
          </nav>
        </div>

        {/* الجزء السفلي */}
        <div className="pt-4 border-t border-zinc-100 space-y-2">
          <a
            href="/"
            target="_blank"
            className="w-full flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80 text-xs font-bold py-2.5 rounded-xl transition"
          >
            <span>زيارة المتجر</span>
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 text-xs font-bold py-2.5 rounded-xl transition duration-150 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* منطقة العمل الرئيسية */}
      <main className="flex-grow p-4 sm:p-8 overflow-y-auto no-scrollbar">

        {/* 1. تبويب الطلبات */}
        {activeTab === 'orders' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">إدارة الطلبات</h1>
                <p className="text-xs text-zinc-400 mt-0.5 font-medium">متابعة ومعالجة الطلبات الواردة من الزبائن</p>
              </div>
              
              <button
                onClick={fetchOrders}
                disabled={loadingOrders}
                className="group flex items-center gap-2 bg-white border border-zinc-200/90 text-xs font-bold px-3.5 py-2 rounded-xl hover:border-zinc-300 hover:bg-zinc-50 transition shadow-2xs active:scale-95 disabled:opacity-60 text-zinc-700"
              >
                <svg
                  className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 transition-transform duration-500 ${loadingOrders ? 'animate-spin' : 'group-hover:rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{loadingOrders ? 'جاري التحديث...' : 'تحديث الطلبات'}</span>
              </button>
            </div>

            {/* كروت الإحصائيات الزرقاء */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-5 rounded-2xl shadow-lg shadow-blue-500/15 relative overflow-hidden border border-blue-500/30">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-100 block mb-1">الطلبات المسجلة</span>
                    <span className="text-3xl font-black tracking-tight">{orders.length} <span className="text-base font-bold text-blue-200">طلب</span></span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              </div>

              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-5 rounded-2xl shadow-lg shadow-indigo-500/15 relative overflow-hidden border border-indigo-500/30">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-100 block mb-1">إجمالي المبيعات</span>
                    <span className="text-3xl font-black tracking-tight">${totalRevenue}</span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 sm:p-6">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
                  <span className="text-zinc-400 text-xs font-bold">جاري تحميل الطلبات...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-xs font-bold">لا توجد طلبات جديدة حالياً.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-zinc-50/50 rounded-2xl border border-zinc-200/80 hover:border-zinc-300 transition duration-200 overflow-hidden"
                    >
                      <div className="bg-zinc-100/60 px-5 py-3 border-b border-zinc-200/70 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[11px] font-black text-zinc-600 uppercase tracking-wider">
                            #{order.id.slice(0, 8)}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-400" dir="ltr">
                          {new Date(order.created_at).toLocaleString('ar-EG', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/60">
                          <div className="space-y-1">
                            <h3 className="text-sm font-black text-zinc-900">
                              {order.customer_name}
                            </h3>
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
                              <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{order.address}</span>
                            </p>
                          </div>

                          <a
                            href={`tel:${order.customer_phone}`}
                            className="self-start sm:self-center inline-flex items-center gap-2 bg-white hover:bg-zinc-900 hover:text-white border border-zinc-200 text-zinc-800 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200 shadow-2xs"
                            dir="ltr"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>{order.customer_phone}</span>
                          </a>
                        </div>

                        {/* صندوق الملاحظات */}
                        {order.notes && (
                          <div className="bg-zinc-100/70 border border-zinc-200/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-700 font-medium flex items-start gap-2">
                            <span className="font-black text-zinc-900 shrink-0">ملاحظة:</span>
                            <span className="leading-relaxed">{order.notes}</span>
                          </div>
                        )}

                        <div className="bg-white rounded-xl p-3 border border-zinc-200/70 space-y-2 shadow-2xs">
                          <span className="text-[10px] font-bold text-zinc-400 block px-1">عناصر الطلب</span>
                          <div className="space-y-1.5">
                            {order.order_items?.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-100 text-xs"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-zinc-900">
                                    {item.products?.title || 'منتج غير محدد'}
                                  </span>
                                  {item.product_variants && (
                                    <span className="bg-white text-zinc-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-zinc-200">
                                      {item.product_variants.color} - {item.product_variants.size}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-zinc-400 font-bold">× {item.quantity}</span>
                                  <span className="font-black text-zinc-900">${item.price_at_purchase}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-zinc-400">الإجمالي:</span>
                            <span className="text-lg font-black text-zinc-900">${order.total_amount}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {order.maps_link && (
                              <a
                                href={order.maps_link}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-400 px-3.5 py-1.5 rounded-xl text-xs font-bold transition duration-150 shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <span>الموقع الخريطة</span>
                              </a>
                            )}

                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition duration-150 active:scale-95"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>إنهاء / حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. تبويب المنتجات */}
        {activeTab === 'products' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">إدارة المنتجات</h1>
              
              {/* زر إضافة منتج بحجم أكبر وأوضح */}
              <button
                onClick={handleOpenAddModal}
                className="bg-zinc-900 hover:bg-black text-white text-sm font-extrabold px-7 py-3.5 rounded-2xl transition duration-200 shadow-md active:scale-95 self-start sm:self-auto"
              >
                + إضافة منتج جديد
              </button>
            </div>

            {/* شريط البحث والفلاتر */}
            <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-[0_2px_10px_rgb(0,0,0,0.02)] space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن منتج بالاسم أو المواصفات..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3.5 pl-12 text-sm font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 focus:bg-white transition"
                />
                <svg className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* أزرار الفلترة - قارب على النفاد مطابق تماماً للبقية */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'top_sales', label: 'الأكثر مبيعاً' },
                  { id: 'low_sales', label: 'الأقل مبيعاً' },
                  { id: 'available', label: 'المعروضة فقط' },
                  { id: 'disabled', label: 'المتوقفة' },
                  { id: 'low_stock', label: 'قارب على النفاد' },
                ].map((tab) => {
                  const isSelected = productFilter === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setProductFilter(tab.id as typeof productFilter)}
                      className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all duration-150 ${
                        isSelected
                          ? 'bg-zinc-900 text-white shadow-sm'
                          : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* بطاقات المنتجات */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 sm:p-6">
              {loadingProducts ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-bold">جاري تحميل المنتجات...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-bold">لا توجد منتجات مطابقة لخيارات البحث.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((p) => {
                    const img = p.product_images?.[0]?.image_url || 'https://via.placeholder.com/300';
                    const hasDiscount = p.original_price && p.original_price > p.price;
                    const isLowStock = (p.total_stock || 0) <= 5;

                    return (
                      <div
                        key={p.id}
                        className="bg-zinc-50/50 border border-zinc-200/80 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-300 transition relative overflow-hidden"
                      >
                        <div>
                          <div className="flex gap-3">
                            <img
                              src={img}
                              alt={p.title}
                              className="w-16 h-16 rounded-xl object-cover shrink-0 bg-white border border-zinc-200"
                            />
                            <div className="overflow-hidden flex-grow">
                              <h4 className="font-bold text-sm text-zinc-900 truncate">{p.title}</h4>
                              <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{p.description}</p>
                              
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-black text-zinc-900 block">${p.price}</span>
                                {hasDiscount && (
                                  <span className="text-xs font-bold text-zinc-400 line-through">
                                    ${p.original_price}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* كاردات المبيعات والمتبقي بالمخزن باللون الأزرق الكامل */}
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-200/60">
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-2.5 text-center shadow-xs border border-blue-500/30">
                              <span className="text-[10px] font-bold text-blue-100 block mb-0.5">المبيعات</span>
                              <span className="text-xs font-black text-white">{p.sales_count || 0} قطعة</span>
                            </div>

                            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-2.5 text-center shadow-xs border border-blue-500/30 relative">
                              <span className="text-[10px] font-bold text-blue-100 block mb-0.5">المتبقي بالمخزن</span>
                              <span className="text-xs font-black text-white">
                                {p.total_stock || 0} قطعة
                              </span>
                            </div>
                          </div>

                          {/* كارد التحذير باللون الأحمر الكامل مع النص الأبيض البارز */}
                          {isLowStock && (
                            <div className="mt-2 bg-red-600 text-white rounded-xl px-3 py-2 text-xs font-bold text-center shadow-xs">
                              {(p.total_stock || 0) === 0 ? 'نفد المخزون بالكامل' : `متبقي بالمخزن: ${p.total_stock} قطع فقط`}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {p.product_variants?.map((v, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md font-semibold"
                              >
                                {v.color} ({v.stock_quantity})
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-200/70 pt-3 mt-3">
                          <button
                            onClick={() => handleToggleProductStatus(p)}
                            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all duration-150 active:scale-95 ${
                              p.is_available
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:text-zinc-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.is_available ? 'bg-emerald-500' : 'bg-zinc-400'
                              }`}
                            />
                            <span>{p.is_available ? 'معروض' : 'متوقف'}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="text-xs font-bold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-400 px-3 py-1 rounded-xl transition shadow-2xs"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-xs font-bold text-rose-500 hover:text-rose-700 px-2 py-1 transition"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. تبويب الإعدادات */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">إعدادات المتجر</h1>
              <p className="text-xs text-zinc-400 mt-0.5 font-medium">التحكم في العبارات والتفضيلات العامة للمتجر</p>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-6 sm:p-8 space-y-6">
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50" />
                  <h3 className="font-extrabold text-sm text-zinc-900">موعد البث المباشر (الشريط الترويجي)</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  هذا النص يظهر بجانب النقطة الحمراء المتحركة في أعلى صفحة الزبون وفي شريط البث المباشر.
                </p>

                <form onSubmit={handleSaveSettings} className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="text"
                      required
                      value={liveStreamText}
                      onChange={(e) => setLiveStreamText(e.target.value)}
                      placeholder="مثال: بث مباشر كل يومين"
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 focus:bg-white transition"
                    />
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold px-6 py-3 rounded-xl transition duration-200 shadow-sm disabled:opacity-50 shrink-0"
                    >
                      {savingSettings ? 'جاري الحفظ...' : 'حفظ التعديل'}
                    </button>
                  </div>

                  {settingsSavedToast && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
                      <span>✓</span>
                      <span>تم تحديث موعد البث بنجاح ويظهر الآن مباشرة لجميع الزوار.</span>
                    </div>
                  )}
                </form>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Modal إضافة / تعديل منتج */}
      {showModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-black text-base text-zinc-900">
                {isEditing ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-700 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: ساعة يد رجالية"
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">الوصف</label>
                <textarea
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="وصف مختصر لمواصفات المنتج"
                  rows={2}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">السعر النهائي ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="45.00"
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    السعر قبل الخصم ($) <span className="text-zinc-400 font-normal">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="54.00"
                    className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 border border-zinc-200/80 p-3 rounded-2xl bg-zinc-50/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-700">الألوان مع كمية المخزن</label>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="text-[11px] font-bold text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-50 px-2 py-1 rounded-lg transition"
                  >
                    + إضافة خيار
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {variantsList.map((variant, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={variant.color}
                        onChange={(e) => handleVariantChange(index, 'color', e.target.value)}
                        placeholder="اسم اللون (مثال: أسود)"
                        className="w-2/3 p-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                      />
                      <input
                        type="number"
                        required
                        value={variant.stock}
                        onChange={(e) => handleVariantChange(index, 'stock', e.target.value)}
                        placeholder="الكمية"
                        className="w-1/3 p-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                      />
                      {variantsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(index)}
                          className="text-rose-500 hover:text-rose-700 text-sm font-bold p-1"
                          title="حذف الخيار"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border border-zinc-200/80 p-3 rounded-2xl bg-zinc-50/60">
                <label className="block text-xs font-bold text-zinc-700">صورة المنتج</label>

                <label className="cursor-pointer w-full bg-zinc-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-zinc-800 transition flex items-center justify-center text-center shadow-xs">
                  {uploadingImage ? 'جاري الرفع...' : 'اختيار صورة من الجهاز'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>

                <div className="relative flex items-center justify-center my-1.5">
                  <div className="border-t border-zinc-200 w-full" />
                  <span className="bg-zinc-50 px-2.5 text-[10px] font-bold text-zinc-400 shrink-0">
                    أو رابط مباشر
                  </span>
                  <div className="border-t border-zinc-200 w-full" />
                </div>

                <input
                  type="url"
                  required
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none text-left"
                  dir="ltr"
                />

                {imageUrl && (
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60 mt-1">
                    <img src={imageUrl} alt="معاينة" className="w-8 h-8 object-cover rounded-lg border border-zinc-200 bg-white shrink-0" />
                    <span className="text-[10px] text-emerald-600 font-bold">تم تحديد الصورة وجاهزة للحفظ</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingProduct || uploadingImage}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-3 rounded-xl transition disabled:opacity-50 mt-1 shadow-sm"
              >
                {submittingProduct
                  ? 'جاري الحفظ...'
                  : isEditing
                  ? 'تحديث وحفظ التعديلات'
                  : 'حفظ المنتج ونشره'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}