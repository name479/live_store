'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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

interface NotificationItem {
  id: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
  read: boolean;
}

const DEFAULT_ADMIN_PIN = 'admin';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);

  // التبويبات
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'quick_sale' | 'add_product' | 'settings'>('orders');

  // حالات فتح وإغلاق القوائم المنسدلة
  const [openManualAdd, setOpenManualAdd] = useState(false);
  const [openExcelAdd, setOpenExcelAdd] = useState(false);
  const [openProfileSettings, setOpenProfileSettings] = useState(false);
  const [openSecuritySettings, setOpenSecuritySettings] = useState(false);
  const [openSessionSettings, setOpenSessionSettings] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  
  // شريط الإشعار الموحد
  const [adminToast, setAdminToast] = useState<string | null>(null);
  
  // شريط البحث
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // قائمة الإشعارات
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // إعدادات المتجر العامة
  const [storeName, setStoreName] = useState('متجر التحرير');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [liveStreamText, setLiveStreamText] = useState('بث مباشر كل 3 أيام');
  const [adminPin, setAdminPin] = useState(DEFAULT_ADMIN_PIN);

  // حقول تعديل الإعدادات
  const [newStoreName, setNewStoreName] = useState('متجر التحرير');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newLiveStreamText, setNewLiveStreamText] = useState('بث مباشر كل 3 أيام');
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingGeneralSettings, setSavingGeneralSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // حالات البحث والفلترة للمنتجات
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'top_sales' | 'low_sales' | 'available' | 'disabled' | 'low_stock'>('all');

  // تعديل منتج موجود
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // حقول نموذج المنتج
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variantsList, setVariantsList] = useState<{ id?: string; color: string; stock: number }[]>([
    { color: 'أسود', stock: 10 },
  ]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  // ----------------- حالات البيع السريع -----------------
  const [posCustomerName, setPosCustomerName] = useState('');
  const [posCustomerPhone, setPosCustomerPhone] = useState('');
  const [posAddress, setPosAddress] = useState('');
  const [posNotes, setPosNotes] = useState('');
  const [posCart, setPosCart] = useState<{ product: Product; variant: Variant | null; quantity: number }[]>([]);
  const [submittingPosOrder, setSubmittingPosOrder] = useState(false);
  const [posSearchProduct, setPosSearchProduct] = useState('');

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

  const showToast = useCallback((msg: string) => {
    setAdminToast(msg);
    setTimeout(() => setAdminToast(null), 3000);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('store_settings').select('key, value');
      if (data) {
        data.forEach((item) => {
          if (item.key === 'store_name') {
            setStoreName(item.value);
            setNewStoreName(item.value);
          }
          if (item.key === 'profile_avatar_url') {
            setProfileAvatarUrl(item.value);
            setNewAvatarUrl(item.value);
          }
          if (item.key === 'live_stream_text') {
            setLiveStreamText(item.value);
            setNewLiveStreamText(item.value);
          }
          if (item.key === 'admin_password') {
            setAdminPin(item.value);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOrders = useCallback(async () => {
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
      const ords = data as unknown as Order[];
      setOrders(ords);
      
      setNotifications(
        ords.slice(0, 10).map((o) => ({
          id: o.id,
          customer_name: o.customer_name,
          total_amount: o.total_amount,
          created_at: o.created_at,
          read: false,
        }))
      );
    }
    setLoadingOrders(false);
  }, []);

  const fetchProducts = useCallback(async () => {
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
  }, []);

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
          const newOrder = payload.new as { id: string; customer_name?: string; total_amount?: number; created_at: string };
          
          showToast(`طلب جديد من ${newOrder.customer_name || 'عميل'} ($${newOrder.total_amount || 0})`);

          setNotifications((prev) => [
            {
              id: newOrder.id,
              customer_name: newOrder.customer_name || 'عميل جديد',
              total_amount: newOrder.total_amount || 0,
              created_at: newOrder.created_at || new Date().toISOString(),
              read: false,
            },
            ...prev,
          ]);

          fetchOrders();
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchOrders, fetchProducts, fetchSettings, showToast]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (cleaned === adminPin) {
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

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneralSettings(true);

    const updates = [
      { key: 'store_name', value: newStoreName.trim() },
      { key: 'profile_avatar_url', value: newAvatarUrl.trim() },
      { key: 'live_stream_text', value: newLiveStreamText.trim() },
    ];

    const { error } = await supabase.from('store_settings').upsert(updates);
    setSavingGeneralSettings(false);

    if (!error) {
      setStoreName(newStoreName.trim());
      setProfileAvatarUrl(newAvatarUrl.trim());
      setLiveStreamText(newLiveStreamText.trim());
      showToast('تم حفظ الإعدادات العامة بنجاح');
    } else {
      alert('تعذر حفظ الإعدادات، يرجى التحقق من الاتصال');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPinInput.trim() !== adminPin) {
      alert('رمز المرور الحالي غير صحيح');
      return;
    }
    if (newPinInput.trim().length < 4) {
      alert('يجب أن يتكون الرمز الجديد من 4 خانات على الأقل');
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      alert('الرمز الجديد وتأكيده غير متطابقين');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase
      .from('store_settings')
      .upsert({ key: 'admin_password', value: newPinInput.trim() });
    setSavingPassword(false);

    if (!error) {
      setAdminPin(newPinInput.trim());
      setOldPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      showToast('تم تغيير رمز المرور بنجاح');
    } else {
      alert('تعذر تحديث الرمز السري');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      setUploadingAvatar(true);
      const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

      if (uploadError) {
        alert('حدث خطأ أثناء رفع الصورة');
        setUploadingAvatar(false);
        return;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      setNewAvatarUrl(data.publicUrl);
      showToast('تم رفع الصورة بنجاح');
    } catch (err) {
      console.error(err);
      alert('تعذر رفع الصورة');
    } finally {
      setUploadingAvatar(false);
    }
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
        alert('حدث خطأ أثناء رفع الصورة');
        setUploadingImage(false);
        return;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      showToast('تم رفع صورة المنتج');
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

  const resetProductForm = () => {
    setTitle('');
    setDesc('');
    setPrice('');
    setOriginalPrice('');
    setImageUrl('');
    setVariantsList([{ color: 'أسود', stock: 10 }]);
    setIsEditing(false);
    setEditingProductId(null);
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
          id: v.id,
          color: v.color,
          stock: v.stock_quantity,
        }))
      );
    } else {
      setVariantsList([{ color: 'افتراضي', stock: 10 }]);
    }

    setShowEditModal(true);
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('هل تريد إنهاء وأرشفة هذا الطلب؟')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast('تمت أرشفة الطلب بنجاح');
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
      showToast(nextStatus ? 'تم عرض المنتج في المتجر' : 'تم إيقاف عرض المنتج');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج نهائياً بجميع خياراته وسجلاته؟')) return;

    try {
      const { data: vars } = await supabase.from('product_variants').select('id').eq('product_id', id);
      if (vars && vars.length > 0) {
        const vIds = vars.map((v) => v.id);
        await supabase.from('order_items').update({ variant_id: null }).in('variant_id', vIds);
      }

      await supabase.from('product_variants').delete().eq('product_id', id);

      try {
        await supabase.from('product_images').delete().eq('product_id', id);
      } catch (_) {}

      const { error } = await supabase.from('products').delete().eq('id', id);

      if (error) {
        alert('تعذر حذف المنتج: ' + error.message);
        return;
      }

      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast('تم حذف المنتج بنجاح');
    } catch (err: any) {
      alert('خطأ أثناء الحذف: ' + err.message);
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
      title: title.trim(),
      description: desc.trim(),
      price: parseFloat(price) || 0,
      original_price: originalPrice ? parseFloat(originalPrice) : null,
    };

    if (isEditing && editingProductId) {
      const { error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProductId);

      if (updateError) {
        alert('خطأ أثناء التعديل: ' + updateError.message);
        setSubmittingProduct(false);
        return;
      }

      if (imageUrl) {
        await supabase.from('product_images').delete().eq('product_id', editingProductId);
        await supabase.from('product_images').insert([
          { product_id: editingProductId, image_url: imageUrl, is_main: true },
        ]);
      }

      const { data: existingVars } = await supabase
        .from('product_variants')
        .select('id, color')
        .eq('product_id', editingProductId);

      if (existingVars && existingVars.length > 0) {
        const vIds = existingVars.map((v) => v.id);
        await supabase.from('order_items').update({ variant_id: null }).in('variant_id', vIds);
        await supabase.from('product_variants').delete().eq('product_id', editingProductId);
      }

      const variantsToInsert = validVariants.map((v) => ({
        product_id: editingProductId,
        color: v.color.trim(),
        size: 'Standard',
        stock_quantity: v.stock,
      }));

      await supabase.from('product_variants').insert(variantsToInsert);

      showToast('تم حفظ التعديلات بنجاح');
      setShowEditModal(false);
    } else {
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .insert([{ ...payload, is_available: true }])
        .select()
        .single();

      if (prodError || !prodData) {
        alert('خطأ أثناء إضافة المنتج: ' + prodError?.message);
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
        color: v.color.trim(),
        size: 'Standard',
        stock_quantity: v.stock,
      }));

      await supabase.from('product_variants').insert(variantsToInsert);

      showToast('تمت إضافة المنتج بنجاح');
      resetProductForm();
      setActiveTab('products');
    }

    setSubmittingProduct(false);
    fetchProducts();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setIsImportingExcel(true);

    try {
      let rows: Record<string, unknown>[] = [];
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      if (fileExt === 'csv') {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');

        if (lines.length > 1) {
          const parseRow = (textLine: string): string[] => {
            const pattern = /(?:,|\r?\n|^)("(?:(?:"")*[^"]*)*"|[^",\r\n]*)/gi;
            const entries: string[] = [];
            let matched: RegExpExecArray | null;

            while ((matched = pattern.exec(textLine)) !== null) {
              let value = matched[1];
              if (value === undefined) break;
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1).replace(/""/g, '"');
              }
              entries.push(value.trim());
            }
            return entries;
          };

          const rawHeaders = parseRow(lines[0]);
          const headers = rawHeaders.map((h) =>
            h.toLowerCase().trim().replace(/['"\r]/g, '')
          );

          for (let i = 1; i < lines.length; i++) {
            const values = parseRow(lines[i]);
            if (values.length >= headers.length) {
              const rowObj: Record<string, unknown> = {};
              headers.forEach((h, idx) => {
                rowObj[h] = values[idx];
              });
              rows.push(rowObj);
            }
          }
        }
      } else {
        const win = window as unknown as { XLSX?: any };
        if (!win.XLSX) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src =
              'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const XLSX = win.XLSX;
        const dataBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }

      if (rows.length === 0) {
        alert('لم يتم العثور على أي بيانات صالحة داخل الملف');
        setIsImportingExcel(false);
        return;
      }

      interface GroupedProduct {
        title: string;
        description: string;
        price: number;
        original_price: number | null;
        image_url: string;
        variants: { color: string; size: string; stock: number }[];
      }

      const productsGrouped: Record<string, GroupedProduct> = {};

      rows.forEach((r) => {
        const getField = (possibleKeys: string[]): string => {
          for (const key of Object.keys(r)) {
            const cleanedKey = key.toLowerCase().trim().replace(/[_-\s]/g, '');
            for (const target of possibleKeys) {
              const cleanedTarget = target.toLowerCase().trim().replace(/[_-\s]/g, '');
              if (cleanedKey === cleanedTarget && r[key] !== undefined && r[key] !== null) {
                return String(r[key]).trim();
              }
            }
          }
          return '';
        };

        const prodTitle = getField(['title', 'اسم المنتج', 'الاسم', 'name']);
        if (!prodTitle) return;

        const prodDesc = getField(['description', 'الوصف', 'desc', 'مواصفات']);
        const prodPrice = parseFloat(getField(['price', 'السعر', 'سعر'])) || 0;
        const rawOrigPrice = getField(['original_price', 'السعر قبل الخصم', 'السعر القديم', 'old_price']);
        const prodOrigPrice =
          rawOrigPrice && rawOrigPrice.toLowerCase() !== 'null' && rawOrigPrice !== ''
            ? parseFloat(rawOrigPrice) || null
            : null;

        let rawImage = getField(['image_url', 'رابط الصورة', 'رابط_الصورة', 'صورة', 'image', 'photo', 'img']);
        rawImage = rawImage.replace(/^["']+|["']+$/g, '').replace(/\\/g, '').trim();
        const prodImage = rawImage.startsWith('http') ? rawImage : '';

        const variantColor = getField(['color', 'اللون', 'لون']) || 'افتراضي';
        const variantSize = getField(['size', 'القياس', 'الحجم', 'قياس']) || 'Standard';
        const rawStock = getField(['stock_quantity', 'الكمية', 'المخزون', 'stock', 'العدد']);
        const variantStock = parseInt(rawStock, 10) || 10;

        const key = prodTitle.toLowerCase();
        if (!productsGrouped[key]) {
          productsGrouped[key] = {
            title: prodTitle,
            description: prodDesc,
            price: prodPrice,
            original_price: prodOrigPrice,
            image_url: prodImage,
            variants: [],
          };
        } else if (!productsGrouped[key].image_url && prodImage) {
          productsGrouped[key].image_url = prodImage;
        }

        productsGrouped[key].variants.push({
          color: variantColor,
          size: variantSize,
          stock: variantStock,
        });
      });

      const groupedList = Object.values(productsGrouped);
      if (groupedList.length === 0) {
        alert('تأكد من احتواء الملف على أعمدة: title, description, price, color, stock_quantity');
        setIsImportingExcel(false);
        return;
      }

      let successCount = 0;

      for (const item of groupedList) {
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .insert([
            {
              title: item.title,
              description: item.description,
              price: item.price,
              original_price: item.original_price,
              is_available: true,
            },
          ])
          .select()
          .single();

        if (!prodError && prodData) {
          if (item.image_url) {
            await supabase.from('product_images').insert([
              {
                product_id: prodData.id,
                image_url: item.image_url,
                is_main: true,
              },
            ]);
          }

          const variantsToInsert = item.variants.map((v) => ({
            product_id: prodData.id,
            color: v.color,
            size: v.size,
            stock_quantity: v.stock,
          }));

          await supabase.from('product_variants').insert(variantsToInsert);
          successCount++;
        }
      }

      fetchProducts();
      showToast(`تم استيراد ${successCount} منتج بنجاح`);
      setActiveTab('products');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء معالجة الملف، يرجى التأكد من التنسيق');
    } finally {
      setIsImportingExcel(false);
    }
  };

  // ----------------- دوال البيع السريع -----------------
  const handleAddToPosCart = (product: Product, variant: Variant | null) => {
    setPosCart((prev) => {
      const idx = prev.findIndex(
        (item) => item.product.id === product.id && item.variant?.id === variant?.id
      );
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
    showToast(`أُضيف: ${product.title}`);
  };

  const handleRemoveFromPosCart = (index: number) => {
    setPosCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePosQuantity = (index: number, delta: number) => {
    setPosCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const posTotalAmount = useMemo(() => {
    return posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [posCart]);

  const handlePosCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posCart.length === 0) {
      alert('يرجى اختيار منتج واحد على الأقل للطلب السريع');
      return;
    }
    if (!posCustomerName.trim() || !posCustomerPhone.trim()) {
      alert('يرجى إدخال اسم الزبون ورقم الهاتف');
      return;
    }

    setSubmittingPosOrder(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            customer_name: posCustomerName.trim(),
            customer_phone: posCustomerPhone.trim(),
            address: posAddress.trim() || 'طلب مباشر من البث',
            notes: posNotes.trim() ? `[طلب بث مباشر] ${posNotes.trim()}` : '[طلب بث مباشر]',
            total_amount: posTotalAmount,
            maps_link: null,
          },
        ])
        .select()
        .single();

      if (orderError || !orderData) {
        alert('حدث خطأ أثناء حفظ الطلب: ' + orderError?.message);
        setSubmittingPosOrder(false);
        return;
      }

      const orderItemsPayload = posCart.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id,
        variant_id: item.variant?.id || null,
        quantity: item.quantity,
        price_at_purchase: item.product.price,
      }));

      await supabase.from('order_items').insert(orderItemsPayload);

      for (const item of posCart) {
        if (item.variant?.id) {
          const currentStock = item.variant.stock_quantity || 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          await supabase
            .from('product_variants')
            .update({ stock_quantity: newStock })
            .eq('id', item.variant.id);
        }
      }

      showToast(`تم تسجيل طلب ${posCustomerName} بنجاح`);
      
      setPosCustomerName('');
      setPosCustomerPhone('');
      setPosAddress('');
      setPosNotes('');
      setPosCart([]);

      fetchOrders();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmittingPosOrder(false);
    }
  };

  const posFilteredProducts = useMemo(() => {
    let list = products.filter((p) => p.is_available);
    if (posSearchProduct.trim()) {
      const q = posSearchProduct.toLowerCase().trim();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return list;
  }, [products, posSearchProduct]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filteredOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return orders;
    const q = orderSearchQuery.trim().toLowerCase().replace('#', '');
    return orders.filter(
      (o) =>
        o.customer_name.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.customer_phone.includes(q)
    );
  }, [orders, orderSearchQuery]);

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
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">{storeName}</h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">أدخل رمز المرور للوصول الآمن</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="رمز الدخول..."
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full p-3.5 pl-11 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-base font-bold text-zinc-900 tracking-wider placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 focus:bg-white transition duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 p-1.5 text-zinc-400 hover:text-zinc-700 transition"
                  title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
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

      {/* شريط الإشعار الموحد */}
      {adminToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/10 text-xs font-bold animate-in fade-in slide-in-from-top duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{adminToast}</span>
        </div>
      )}

      {/* السايد بار مع توحيد ألوان البيع السريع لتكون كلاسيكية */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-zinc-200/80 px-2 py-2 md:relative md:border-t-0 md:border-l md:w-24 md:p-3 md:py-6 flex md:flex-col items-center justify-around md:justify-start shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:shadow-none">
        <nav className="w-full flex md:flex-col items-center justify-around md:justify-start gap-1 md:gap-2.5">
          
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 md:flex-initial md:w-full flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl text-center transition-all duration-200 active:scale-95 ${
              activeTab === 'orders'
                ? 'text-zinc-950 bg-zinc-100 shadow-xs font-black'
                : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 font-bold'
            }`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'orders' ? 2.3 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-[10px] md:text-[11px] tracking-tight">الطلبات</span>
          </button>

          {/* زر البيع السريع بأيقونة كلاسيكية بدون أحمر */}
          <button
            onClick={() => setActiveTab('quick_sale')}
            className={`flex-1 md:flex-initial md:w-full flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl text-center transition-all duration-200 active:scale-95 ${
              activeTab === 'quick_sale'
                ? 'text-zinc-950 bg-zinc-100 shadow-xs font-black'
                : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 font-bold'
            }`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'quick_sale' ? 2.3 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[10px] md:text-[11px] tracking-tight">بيع سريع</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 md:flex-initial md:w-full flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl text-center transition-all duration-200 active:scale-95 ${
              activeTab === 'products'
                ? 'text-zinc-950 bg-zinc-100 shadow-xs font-black'
                : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 font-bold'
            }`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'products' ? 2.3 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px] md:text-[11px] tracking-tight">المنتجات</span>
          </button>

          <button
            onClick={() => {
              resetProductForm();
              setActiveTab('add_product');
            }}
            className={`flex-1 md:flex-initial md:w-full flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl text-center transition-all duration-200 active:scale-95 ${
              activeTab === 'add_product'
                ? 'text-zinc-950 bg-zinc-100 shadow-xs font-black'
                : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 font-bold'
            }`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] md:text-[11px] tracking-tight">إضافة منتج</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 md:flex-initial md:w-full flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl text-center transition-all duration-200 active:scale-95 ${
              activeTab === 'settings'
                ? 'text-zinc-950 bg-zinc-100 shadow-xs font-black'
                : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 font-bold'
            }`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] md:text-[11px] tracking-tight">الإعدادات</span>
          </button>
        </nav>
      </aside>

      {/* منطقة العمل الرئيسية */}
      <main className="flex-grow p-4 sm:p-8 pb-24 md:pb-8 overflow-y-auto no-scrollbar">

        {/* 1. تبويب الطلبات */}
        {activeTab === 'orders' && (
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* الهيدر العلوي */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 w-full">
                
                <div className="flex items-center">
                  <span className="text-base sm:text-lg font-black tracking-wider text-zinc-950 select-none">
                    {storeName}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative flex items-center">
                    {showSearchInput ? (
                      <div className="flex items-center bg-zinc-200/60 rounded-full px-3 py-1.5 transition-all duration-200 animate-in fade-in w-40 sm:w-56">
                        <input
                          type="text"
                          autoFocus
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          placeholder="اسم، رقم، هاتف..."
                          className="bg-transparent text-xs font-bold text-zinc-900 outline-none w-full border-none focus:ring-0 placeholder:text-zinc-500 placeholder:font-medium p-0"
                        />
                        <button
                          onClick={() => {
                            setShowSearchInput(false);
                            setOrderSearchQuery('');
                          }}
                          className="text-zinc-400 hover:text-zinc-700 text-xs p-1 mr-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSearchInput(true)}
                        className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95"
                        title="بحث في الطلبات"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="relative" ref={notificationsRef}>
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (!showNotifications) markNotificationsAsRead();
                      }}
                      className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95 relative"
                      title="الإشعارات"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
                      )}
                    </button>

                    {showNotifications && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 sm:hidden bg-black/10" 
                          onClick={() => setShowNotifications(false)} 
                        />
                        
                        <div className="fixed inset-x-4 top-16 sm:inset-auto sm:absolute sm:top-full sm:mt-2 sm:left-0 sm:right-auto w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 bg-white rounded-2xl shadow-2xl border border-zinc-200/90 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-right">
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-2">
                            <span className="font-extrabold text-xs text-zinc-900">إشعارات الطلبات</span>
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">
                              {notifications.length} طلب
                            </span>
                          </div>

                          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                            {notifications.length === 0 ? (
                              <div className="text-center py-6 text-zinc-400 text-xs font-medium">
                                لا توجد إشعارات حالياً
                              </div>
                            ) : (
                              notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  className="p-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition text-xs space-y-1 border border-zinc-100"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-zinc-900">{notif.customer_name}</span>
                                    <span className="font-black text-zinc-900">${notif.total_amount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                    <span>طلب جديد #{notif.id.slice(0, 6)}</span>
                                    <span dir="ltr">{new Date(notif.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={fetchOrders}
                    disabled={loadingOrders}
                    className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95 disabled:opacity-50"
                    title="تحديث البيانات"
                  >
                    <svg
                      className={`w-6 h-6 ${loadingOrders ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  <div 
                    onClick={() => setActiveTab('settings')}
                    className="relative flex items-center justify-center p-0.5 rounded-full border-2 border-rose-500 shadow-sm cursor-pointer hover:opacity-90 transition shrink-0"
                    title="إعدادات الحساب"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-white flex items-center justify-center overflow-hidden">
                      {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm shadow-inner">
                          {storeName.slice(0, 1) || 'S'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">إدارة الطلبات</h1>
                <p className="text-xs text-zinc-400 font-medium">متابعة ومعالجة الطلبات الواردة من الزبائن</p>
              </div>

            </div>

            {/* كروت الإحصائيات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-red-600 to-rose-700 text-white p-5 rounded-2xl shadow-lg shadow-red-500/15 relative overflow-hidden border border-red-500/30">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-red-100 block mb-1">الطلبات المسجلة</span>
                    <span className="text-3xl font-black tracking-tight">{orders.length} <span className="text-base font-bold text-red-200">طلب</span></span>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              </div>

              <div className="bg-gradient-to-br from-rose-600 to-red-700 text-white p-5 rounded-2xl shadow-lg shadow-rose-500/15 relative overflow-hidden border border-rose-500/30">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-red-100 block mb-1">إجمالي المبيعات</span>
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

            {/* جدول وبطاقات الطلبات */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 sm:p-6">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
                  <span className="text-zinc-400 text-xs font-bold">جاري تحميل الطلبات...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-xs font-bold">
                  {orderSearchQuery ? 'لا توجد نتائج مطابقة لبحث الطلبات.' : 'لا توجد طلبات جديدة حالياً.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-zinc-50/50 rounded-2xl border border-zinc-200/80 hover:border-zinc-300 transition duration-200 overflow-hidden"
                    >
                      <div className="bg-zinc-100/60 px-5 py-3 border-b border-zinc-200/70 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
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
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-400 px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shadow-2xs"
                              >
                                <span>عرض الموقع</span>
                              </a>
                            )}

                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition duration-150 active:scale-95 shadow-xs shadow-rose-600/20"
                            >
                              <span>إنهاء أو حذف</span>
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

        {/* ----------------- 2. تبويب البيع السريع (POS) المعدل ----------------- */}
        {activeTab === 'quick_sale' && (
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* الهيدر العلوي المتطابق تماماً مع صفحة الطلبات واللوغو بنفس مكانه */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 w-full">
                
                <div className="flex items-center">
                  <span className="text-base sm:text-lg font-black tracking-wider text-zinc-950 select-none">
                    {storeName}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative flex items-center">
                    {showSearchInput ? (
                      <div className="flex items-center bg-zinc-200/60 rounded-full px-3 py-1.5 transition-all duration-200 animate-in fade-in w-40 sm:w-56">
                        <input
                          type="text"
                          autoFocus
                          value={posSearchProduct}
                          onChange={(e) => setPosSearchProduct(e.target.value)}
                          placeholder="ابحث عن منتج..."
                          className="bg-transparent text-xs font-bold text-zinc-900 outline-none w-full border-none focus:ring-0 placeholder:text-zinc-500 placeholder:font-medium p-0"
                        />
                        <button
                          onClick={() => {
                            setShowSearchInput(false);
                            setPosSearchProduct('');
                          }}
                          className="text-zinc-400 hover:text-zinc-700 text-xs p-1 mr-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSearchInput(true)}
                        className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95"
                        title="بحث في المنتجات"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="relative" ref={notificationsRef}>
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (!showNotifications) markNotificationsAsRead();
                      }}
                      className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95 relative"
                      title="الإشعارات"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
                      )}
                    </button>

                    {showNotifications && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 sm:hidden bg-black/10" 
                          onClick={() => setShowNotifications(false)} 
                        />
                        
                        <div className="fixed inset-x-4 top-16 sm:inset-auto sm:absolute sm:top-full sm:mt-2 sm:left-0 sm:right-auto w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 bg-white rounded-2xl shadow-2xl border border-zinc-200/90 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-right">
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-2">
                            <span className="font-extrabold text-xs text-zinc-900">إشعارات الطلبات</span>
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">
                              {notifications.length} طلب
                            </span>
                          </div>

                          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                            {notifications.length === 0 ? (
                              <div className="text-center py-6 text-zinc-400 text-xs font-medium">
                                لا توجد إشعارات حالياً
                              </div>
                            ) : (
                              notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  className="p-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition text-xs space-y-1 border border-zinc-100"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-zinc-900">{notif.customer_name}</span>
                                    <span className="font-black text-zinc-900">${notif.total_amount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                    <span>طلب جديد #{notif.id.slice(0, 6)}</span>
                                    <span dir="ltr">{new Date(notif.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={fetchProducts}
                    disabled={loadingProducts}
                    className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95 disabled:opacity-50"
                    title="تحديث البيانات"
                  >
                    <svg
                      className={`w-6 h-6 ${loadingProducts ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  <div 
                    onClick={() => setActiveTab('settings')}
                    className="relative flex items-center justify-center p-0.5 rounded-full border-2 border-rose-500 shadow-sm cursor-pointer hover:opacity-90 transition shrink-0"
                    title="إعدادات الحساب"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-white flex items-center justify-center overflow-hidden">
                      {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm shadow-inner">
                          {storeName.slice(0, 1) || 'S'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* العنوان الصافي مع التباعد المنظم مثل بقية الصفحات وبدون عبارة POS */}
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">البيع السريع</h1>
                <p className="text-xs text-zinc-400 font-medium">تسجيل طلبات الزبائن مباشرة بنقرة واحدة وتوثيقها فوراً في النظام أثناء البث</p>
              </div>

            </div>

            {/* الحاويتان متساويتان في الطول (items-stretch) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* القسم الأيمن: استعراض المنتجات واختيارها */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 sm:p-6 flex flex-col justify-between">
                
                <div className="space-y-4 flex-grow flex flex-col">
                  <div className="relative">
                    <input
                      type="text"
                      value={posSearchProduct}
                      onChange={(e) => setPosSearchProduct(e.target.value)}
                      placeholder="ابحث عن منتج بالاسم..."
                      className="w-full p-3 pr-10 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                    />
                    <div className="absolute right-3.5 top-3.5 text-zinc-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  <div className="h-[68vh] overflow-y-auto no-scrollbar space-y-3 pt-1 flex-grow">
                    {posFilteredProducts.length === 0 ? (
                      <div className="text-center py-24 text-zinc-400 text-xs font-bold">
                        لا توجد منتجات متوفرة للبيع السريع.
                      </div>
                    ) : (
                      posFilteredProducts.map((p) => {
                        const img = p.product_images?.[0]?.image_url || 'https://placehold.co/100x100?text=Item';

                        return (
                          <div
                            key={p.id}
                            className="p-3 bg-zinc-50/70 hover:bg-zinc-100/60 rounded-2xl border border-zinc-200/80 transition duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={img}
                                alt={p.title}
                                className="w-14 h-14 rounded-xl object-cover bg-white border border-zinc-200 shrink-0"
                              />
                              <div>
                                <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 leading-tight">
                                  {p.title}
                                </h4>
                                <span className="text-xs font-black text-zinc-900 mt-1 block">
                                  ${p.price}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-semibold">
                                  المتوفر بالمستودع: {p.total_stock || 0}
                                </span>
                              </div>
                            </div>

                            {/* أزرار إضافة الألوان والخيارات للطلب بنقرة واحدة */}
                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-end">
                              {p.product_variants && p.product_variants.length > 0 ? (
                                p.product_variants.map((v) => (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => handleAddToPosCart(p, v)}
                                    className="text-[11px] font-bold bg-white hover:bg-zinc-900 hover:text-white border border-zinc-200 px-3 py-1.5 rounded-xl transition shadow-2xs active:scale-95 text-zinc-800"
                                  >
                                    + {v.color}
                                  </button>
                                ))
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddToPosCart(p, null)}
                                  className="text-xs font-bold bg-zinc-900 hover:bg-black text-white px-3.5 py-1.5 rounded-xl transition shadow-2xs active:scale-95"
                                >
                                  + إضافة
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* القسم الأيسر: فورم وفاتورة البيع السريع بطول مماثل ومتناسق */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 sm:p-6 flex flex-col justify-between">
                
                <div className="space-y-4 flex-grow flex flex-col">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <h3 className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                      <span>فاتورة الطلب السريع</span>
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-bold">
                        {posCart.length} عناصر
                      </span>
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-zinc-950">${posTotalAmount}</span>
                      {posCart.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPosCart([])}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          إفراغ
                        </button>
                      )}
                    </div>
                  </div>

                  {/* قائمة العناصر المختارة */}
                  {posCart.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 text-xs font-bold border-2 border-dashed border-zinc-100 rounded-2xl flex items-center justify-center">
                      اضغط على أي منتج من القائمة لإضافته للطلب
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                      {posCart.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-zinc-50 px-3 py-2.5 rounded-xl border border-zinc-200/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-zinc-900 block">{item.product.title}</span>
                            <span className="text-[10px] text-zinc-500 font-semibold">
                              {item.variant ? item.variant.color : 'افتراضي'} (${item.product.price})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdatePosQuantity(idx, -1)}
                              className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center font-black text-zinc-700 hover:bg-zinc-100"
                            >
                              -
                            </button>
                            <span className="font-black text-zinc-900 w-4 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdatePosQuantity(idx, 1)}
                              className="w-6 h-6 rounded-lg bg-white border border-zinc-200 flex items-center justify-center font-black text-zinc-700 hover:bg-zinc-100"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromPosCart(idx)}
                              className="text-rose-500 hover:text-rose-700 text-xs font-black p-1 mr-1"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* نموذج معلومات الزبون المطول ليملأ المساحة بتناسق */}
                  <form onSubmit={handlePosCheckout} className="space-y-3.5 pt-3 border-t border-zinc-100 flex-grow flex flex-col justify-between">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">اسم الزبون / المعرف</label>
                        <input
                          type="text"
                          required
                          value={posCustomerName}
                          onChange={(e) => setPosCustomerName(e.target.value)}
                          placeholder="مثال: أحمد علي (أو يوزر البث)"
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">رقم الهاتف</label>
                        <input
                          type="tel"
                          required
                          value={posCustomerPhone}
                          onChange={(e) => setPosCustomerPhone(e.target.value)}
                          placeholder="07700000000"
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">العنوان أو المحافظة</label>
                        <input
                          type="text"
                          value={posAddress}
                          onChange={(e) => setPosAddress(e.target.value)}
                          placeholder="مثال: ديالى - بعقوبة"
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">ملاحظة البث (اختياري)</label>
                        <textarea
                          rows={2}
                          value={posNotes}
                          onChange={(e) => setPosNotes(e.target.value)}
                          placeholder="مثال: خصم خاص للبث، تسليم مستعجل..."
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none"
                        />
                      </div>
                    </div>

                    {/* زر التأكيد بدون أيقونة الصاعقة */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submittingPosOrder || posCart.length === 0}
                        className="w-full bg-zinc-900 hover:bg-black text-white text-xs font-black py-4 rounded-2xl transition disabled:opacity-50 shadow-md active:scale-[0.99] flex items-center justify-center"
                      >
                        {submittingPosOrder ? (
                          <span>جاري حفظ الطلب في النظام...</span>
                        ) : (
                          <span>تأكيد وتسجيل الطلب (${posTotalAmount})</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* 3. تبويب استعراض وإدارة المنتجات */}
        {activeTab === 'products' && (
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* الهيدر العلوي للمنتجات */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 w-full">
                
                <div className="flex items-center">
                  <span className="text-base sm:text-lg font-black tracking-wider text-zinc-950 select-none">
                    {storeName}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative flex items-center">
                    {showSearchInput ? (
                      <div className="flex items-center bg-zinc-200/60 rounded-full px-3 py-1.5 transition-all duration-200 animate-in fade-in w-40 sm:w-56">
                        <input
                          type="text"
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ابحث باسم المنتج..."
                          className="bg-transparent text-xs font-bold text-zinc-900 outline-none w-full border-none focus:ring-0 placeholder:text-zinc-500 placeholder:font-medium p-0"
                        />
                        <button
                          onClick={() => {
                            setShowSearchInput(false);
                            setSearchQuery('');
                          }}
                          className="text-zinc-400 hover:text-zinc-700 text-xs p-1 mr-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSearchInput(true)}
                        className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95"
                        title="بحث في المنتجات"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="relative" ref={notificationsRef}>
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (!showNotifications) markNotificationsAsRead();
                      }}
                      className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95 relative"
                      title="الإشعارات"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
                      )}
                    </button>

                    {showNotifications && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 sm:hidden bg-black/10" 
                          onClick={() => setShowNotifications(false)} 
                        />
                        
                        <div className="fixed inset-x-4 top-16 sm:inset-auto sm:absolute sm:top-full sm:mt-2 sm:left-0 sm:right-auto w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 bg-white rounded-2xl shadow-2xl border border-zinc-200/90 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-right">
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-2">
                            <span className="font-extrabold text-xs text-zinc-900">إشعارات المتجر</span>
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-bold">
                              {notifications.length} طلب
                            </span>
                          </div>

                          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                            {notifications.length === 0 ? (
                              <div className="text-center py-6 text-zinc-400 text-xs font-medium">
                                لا توجد إشعارات حالياً
                              </div>
                            ) : (
                              notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  className="p-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition text-xs space-y-1 border border-zinc-100"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-zinc-900">{notif.customer_name}</span>
                                    <span className="font-black text-zinc-900">${notif.total_amount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                    <span>طلب جديد #{notif.id.slice(0, 6)}</span>
                                    <span dir="ltr">{new Date(notif.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={fetchProducts}
                    disabled={loadingProducts}
                    className="p-2 text-zinc-600 hover:text-zinc-900 transition active:scale-95 disabled:opacity-50"
                    title="تحديث المنتجات"
                  >
                    <svg
                      className={`w-6 h-6 ${loadingProducts ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  <div 
                    onClick={() => setActiveTab('settings')}
                    className="relative flex items-center justify-center p-0.5 rounded-full border-2 border-rose-500 shadow-sm cursor-pointer hover:opacity-90 transition shrink-0"
                    title="إعدادات الحساب"
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-white flex items-center justify-center overflow-hidden">
                      {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm shadow-inner">
                          {storeName.slice(0, 1) || 'S'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">إدارة المنتجات</h1>
                <p className="text-xs text-zinc-400 font-medium">استعراض وتعديل المخزون والأسعار وحالة المنتجات المعروضة</p>
              </div>

            </div>

            {/* شريط الفلاتر */}
            <div className="overflow-x-auto pb-1 no-scrollbar">
              <div className="flex items-center gap-2 text-xs">
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
                      className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all duration-150 ${
                        isSelected
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200/70'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* شبكة بطاقات المنتجات */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 sm:p-6">
              {loadingProducts ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-bold">جاري تحميل المنتجات...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs font-bold">لا توجد منتجات مطابقة لخيارات البحث.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((p) => {
                    const rawImg = p.product_images?.[0]?.image_url?.replace(/^["']+|["']+$/g, '').trim();
                    const img = rawImg && rawImg.startsWith('http') ? rawImg : 'https://placehold.co/300x300?text=No+Image';
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
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/300x300?text=No+Image';
                              }}
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

                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-200/60">
                            <div className="bg-gradient-to-br from-red-600 to-rose-700 text-white rounded-xl p-2.5 text-center shadow-xs border border-red-500/30">
                              <span className="text-[10px] font-bold text-red-100 block mb-0.5">المبيعات</span>
                              <span className="text-xs font-black text-white">{p.sales_count || 0} قطعة</span>
                            </div>

                            <div className="bg-gradient-to-br from-red-600 to-rose-700 text-white rounded-xl p-2.5 text-center shadow-xs border border-red-500/30 relative">
                              <span className="text-[10px] font-bold text-red-100 block mb-0.5">المتبقي بالمخزن</span>
                              <span className="text-xs font-black text-white">
                                {p.total_stock || 0} قطعة
                              </span>
                            </div>
                          </div>

                          {isLowStock && (
                            <div className="mt-2 bg-red-600 text-white rounded-xl px-3 py-2 text-xs font-bold text-center shadow-xs">
                              {(p.total_stock || 0) === 0 ? 'نفد المخزون بالكامل' : `متبقي بالمخزن: ${p.total_stock} قطع فقط`}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {p.product_variants?.map((v, i) => (
                              <span
                                key={v.id || i}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                                  v.stock_quantity === 0
                                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                                    : 'bg-white border-zinc-200 text-zinc-600'
                                }`}
                              >
                                {v.color} ({v.stock_quantity})
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-200/70 pt-3 mt-3">
                          <button
                            onClick={() => handleToggleProductStatus(p)}
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all duration-150 active:scale-95 bg-zinc-100 text-zinc-500 border-zinc-200 hover:text-zinc-800"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.is_available ? 'bg-rose-600' : 'bg-zinc-400'
                              }`}
                            />
                            <span>{p.is_available ? 'معروض' : 'متوقف'}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="text-xs font-bold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-400 px-3 py-1.5 rounded-xl transition shadow-2xs"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-xs font-extrabold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-3 py-1.5 rounded-xl transition duration-150 active:scale-95 shadow-xs shadow-rose-600/20"
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

        {/* 4. صفحة إضافة المنتجات */}
        {activeTab === 'add_product' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">إضافة منتج</h1>
            </div>

            {/* إضافة منتج يدوياً */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenManualAdd(!openManualAdd)}
                className="w-full p-6 sm:p-7 flex items-center justify-between text-right hover:bg-zinc-50/70 transition select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-900 font-bold shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-base text-zinc-900">إضافة منتج يدوياً</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">إدخال تفاصيل منتج مفرد مع الألوان والمخزون والصور</p>
                  </div>
                </div>

                <div className={`w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 shadow-2xs flex items-center justify-center text-zinc-600 transition-transform duration-300 ${openManualAdd ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {openManualAdd && (
                <div className="p-6 sm:p-8 pt-0 border-t border-zinc-100 space-y-4 animate-in fade-in duration-200">
                  <form onSubmit={handleSaveProduct} className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">اسم المنتج</label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="مثال: ساعة يد رجالية فاخرة"
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">الوصف والمواصفات</label>
                      <textarea
                        required
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="اكتب وصفاً جذاباً لمواصفات المنتج للزبائن..."
                        rows={3}
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">السعر النهائي ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="45.00"
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
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
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                        />
                      </div>
                    </div>

                    {/* خيارات الألوان والمخزون */}
                    <div className="space-y-3 border border-zinc-200/80 p-4 rounded-2xl bg-zinc-50/60">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold text-zinc-800">الألوان مع كمية المخزن المتوفرة</label>
                        <button
                          type="button"
                          onClick={handleAddVariant}
                          className="text-xs font-bold text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-100 px-3 py-1.5 rounded-xl transition shadow-2xs"
                        >
                          + إضافة لون / خيار
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
                              placeholder="اسم اللون (مثال: أسود، أزرق)"
                              className="w-2/3 p-2.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                            />
                            <input
                              type="number"
                              required
                              value={variant.stock}
                              onChange={(e) => handleVariantChange(index, 'stock', e.target.value)}
                              placeholder="الكمية"
                              className="w-1/3 p-2.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                            />
                            {variantsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(index)}
                                className="text-rose-500 hover:text-rose-700 text-sm font-bold p-1.5"
                                title="حذف الخيار"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* صورة المنتج */}
                    <div className="space-y-3 border border-zinc-200/80 p-4 rounded-2xl bg-zinc-50/60">
                      <label className="block text-xs font-extrabold text-zinc-800">صورة المنتج الرئيسية</label>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className="cursor-pointer bg-zinc-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-black transition flex items-center justify-center text-center shadow-xs shrink-0">
                          {uploadingImage ? 'جاري الرفع...' : 'اختيار صورة من الجهاز'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>

                        <input
                          type="url"
                          required
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="أو ضع رابط صورة مباشر..."
                          className="flex-1 p-2.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none"
                          dir="ltr"
                        />
                      </div>

                      {imageUrl && (
                        <div className="flex items-center gap-3 pt-2 border-t border-zinc-200/60 mt-2">
                          <img src={imageUrl} alt="معاينة" className="w-12 h-12 object-cover rounded-xl border border-zinc-200 bg-white shrink-0" />
                          <span className="text-xs text-emerald-600 font-bold">تم تحديد الصورة وجاهزة للنشر</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submittingProduct || uploadingImage}
                      className="w-full bg-zinc-900 hover:bg-black text-white text-xs font-black py-4 rounded-2xl transition disabled:opacity-50 shadow-md active:scale-[0.99]"
                    >
                      {submittingProduct ? 'جاري النشر...' : 'حفظ ونشر المنتج في المتجر الآن'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* إرفاق ملف Excel */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenExcelAdd(!openExcelAdd)}
                className="w-full p-6 sm:p-7 flex items-center justify-between text-right hover:bg-zinc-50/70 transition select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-900 font-bold shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-base text-zinc-900">إرفاق ملف Excel</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">استيراد المنتجات وقوائم الأسعار والمخزون دفعة واحدة</p>
                  </div>
                </div>

                <div className={`w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 shadow-2xs flex items-center justify-center text-zinc-600 transition-transform duration-300 ${openExcelAdd ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {openExcelAdd && (
                <div className="p-6 sm:p-8 pt-0 border-t border-zinc-100 space-y-4 animate-in fade-in duration-200">
                  <div className="pt-4">
                    <div className="border-2 border-dashed border-zinc-300 hover:border-rose-500 transition-colors rounded-2xl p-8 text-center bg-zinc-50/60 flex flex-col items-center justify-center gap-3">
                      <label className={`cursor-pointer inline-flex items-center gap-2 bg-zinc-900 hover:bg-black text-white text-xs font-black px-6 py-3 rounded-xl transition shadow-md active:scale-95 ${isImportingExcel ? 'opacity-60 pointer-events-none' : ''}`}>
                        {isImportingExcel ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>جاري معالجة ورفع المنتجات...</span>
                          </>
                        ) : (
                          <span>اختر ملف Excel أو CSV من جهازك</span>
                        )}
                        <input
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          disabled={isImportingExcel}
                          onChange={handleExcelUpload}
                          className="hidden"
                        />
                      </label>
                      {excelFileName && !isImportingExcel && (
                        <p className="text-xs text-rose-600 font-bold">✓ تم اختيار: {excelFileName}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 5. تبويب الإعدادات */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">الإعدادات</h1>
            </div>

            {/* الملف التعريفي وهوية المتجر */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenProfileSettings(!openProfileSettings)}
                className="w-full p-6 sm:p-7 flex items-center justify-between text-right hover:bg-zinc-50/70 transition select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-900 font-bold shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-base text-zinc-900">الملف التعريفي وهوية المتجر</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">تعديل اسم المتجر، الصورة الرمزية، وشريط البث الترويجي</p>
                  </div>
                </div>

                <div className={`w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 shadow-2xs flex items-center justify-center text-zinc-600 transition-transform duration-300 ${openProfileSettings ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {openProfileSettings && (
                <div className="p-6 sm:p-8 pt-0 border-t border-zinc-100 space-y-4 animate-in fade-in duration-200">
                  <form onSubmit={handleSaveGeneralSettings} className="space-y-4 pt-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                      <div className="relative flex items-center justify-center p-0.5 rounded-full border-2 border-rose-500 shadow-sm shrink-0">
                        <div className="w-14 h-14 rounded-full p-[2px] bg-white flex items-center justify-center overflow-hidden">
                          {newAvatarUrl ? (
                            <img src={newAvatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <div className="w-full h-full rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-lg shadow-inner">
                              {newStoreName.slice(0, 1) || 'S'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 w-full">
                        <label className="block text-xs font-bold text-zinc-700">صورة الحساب الشخصي</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <label className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shrink-0 shadow-xs">
                            {uploadingAvatar ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleAvatarUpload}
                              disabled={uploadingAvatar}
                              className="hidden"
                            />
                          </label>
                          <input
                            type="url"
                            value={newAvatarUrl}
                            onChange={(e) => setNewAvatarUrl(e.target.value)}
                            placeholder="أو ضع رابط صورة مباشر من الإنترنت..."
                            className="flex-1 bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">اسم المتجر</label>
                      <input
                        type="text"
                        required
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        placeholder="اسم المتجر الذي يظهر للزبائن وفي لوحة التحكم"
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">موعد البث المباشر (الشريط الترويجي)</label>
                      <input
                        type="text"
                        required
                        value={newLiveStreamText}
                        onChange={(e) => setNewLiveStreamText(e.target.value)}
                        placeholder="مثال: بث مباشر كل يومين الساعة 9 مساءً"
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingGeneralSettings || uploadingAvatar}
                      className="w-full bg-zinc-900 hover:bg-black text-white text-xs font-black py-3.5 rounded-2xl transition disabled:opacity-50 shadow-md active:scale-[0.99]"
                    >
                      {savingGeneralSettings ? 'جاري الحفظ...' : 'حفظ التعديلات العامة'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* أمان لوحة التحكم (الرمز السري) */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenSecuritySettings(!openSecuritySettings)}
                className="w-full p-6 sm:p-7 flex items-center justify-between text-right hover:bg-zinc-50/70 transition select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-900 font-bold shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-base text-zinc-900">أمان لوحة التحكم (الرمز السري)</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">تحديث الرمز المستخدم لتسجيل الدخول إلى لوحة المدير</p>
                  </div>
                </div>

                <div className={`w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 shadow-2xs flex items-center justify-center text-zinc-600 transition-transform duration-300 ${openSecuritySettings ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {openSecuritySettings && (
                <div className="p-6 sm:p-8 pt-0 border-t border-zinc-100 space-y-4 animate-in fade-in duration-200">
                  <form onSubmit={handleUpdatePassword} className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">رمز المرور الحالي</label>
                      <input
                        type="password"
                        required
                        value={oldPinInput}
                        onChange={(e) => setOldPinInput(e.target.value)}
                        placeholder="أدخل الرمز الحالي"
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">الرمز السري الجديد</label>
                        <input
                          type="password"
                          required
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value)}
                          placeholder="رمز جديد (4 خانات فأكثر)"
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-700 mb-1">تأكيد الرمز الجديد</label>
                        <input
                          type="password"
                          required
                          value={confirmPinInput}
                          onChange={(e) => setConfirmPinInput(e.target.value)}
                          placeholder="أعد إدخال الرمز الجديد"
                          className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="w-full bg-zinc-900 hover:bg-black text-white text-xs font-black py-3.5 rounded-2xl transition disabled:opacity-50 shadow-md active:scale-[0.99]"
                    >
                      {savingPassword ? 'جاري التحديث...' : 'تحديث رمز المرور'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* إدارة الجلسة وزيارة المتجر */}
            <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenSessionSettings(!openSessionSettings)}
                className="w-full p-6 sm:p-7 flex items-center justify-between text-right hover:bg-zinc-50/70 transition select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-900 font-bold shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-black text-base text-zinc-900">إدارة الجلسة والمتجر</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">الوصول السريع إلى واجهة المتجر أو تسجيل الخروج من الإدارة</p>
                  </div>
                </div>

                <div className={`w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 shadow-2xs flex items-center justify-center text-zinc-600 transition-transform duration-300 ${openSessionSettings ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {openSessionSettings && (
                <div className="p-6 sm:p-8 pt-0 border-t border-zinc-100 space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <a
                      href="/"
                      target="_blank"
                      className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 text-zinc-800 transition active:scale-[0.99] group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shadow-xs group-hover:scale-105 transition">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        <div>
                          <span className="block font-black text-xs text-zinc-900">زيارة واجهة المتجر</span>
                          <span className="text-[10px] text-zinc-400 font-medium">عرض صفحة تجربة المستخدم</span>
                        </div>
                      </div>
                    </a>

                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/50 hover:bg-rose-100/70 border border-rose-200 text-rose-700 transition active:scale-[0.99] group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs group-hover:scale-105 transition">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <span className="block font-black text-xs text-rose-700">تسجيل الخروج</span>
                          <span className="text-[10px] text-rose-400 font-medium">إنهاء جلسة الإدارة الحالية</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Modal تعديل منتج موجود */}
      {showEditModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-black text-base text-zinc-900">
                تعديل بيانات المنتج والمخزون
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
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
                  placeholder="مثال: قميص رجالي"
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
                    className="text-[11px] font-bold text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-100 px-2 py-1 rounded-lg transition"
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
                  placeholder="https://..."
                  className="w-full p-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none text-left"
                  dir="ltr"
                />

                {imageUrl && (
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60 mt-1">
                    <img src={imageUrl} alt="معاينة" className="w-8 h-8 object-cover rounded-lg border border-zinc-200 bg-white shrink-0" />
                    <span className="text-[10px] text-emerald-600 font-bold">تم تحديد الصورة</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingProduct || uploadingImage}
                className="w-full bg-zinc-900 hover:bg-black text-white text-xs font-bold py-3.5 rounded-xl transition disabled:opacity-50 mt-1 shadow-sm"
              >
                {submittingProduct ? 'جاري الحفظ...' : 'تحديث وحفظ التعديلات'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}