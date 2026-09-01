'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface Variant {
  id: string;
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
  sales_count?: number;
  product_images: { image_url: string }[];
  product_variants: Variant[];
}

interface CartItem {
  product: Product;
  variant: Variant | null;
  quantity: number;
}

const getColorHex = (colorName: string): string => {
  if (!colorName) return '#111111';

  const norm = colorName
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^ال/, '');

  if (norm.includes('اسود') || norm.includes('black')) return '#111111';
  if (norm.includes('ابيض') || norm.includes('white')) return '#FFFFFF';
  if (norm.includes('احمر') || norm.includes('red')) return '#EF4444';
  if (norm.includes('وردي') || norm.includes('زهري') || norm.includes('pink')) return '#F472B6';
  if (norm.includes('ازرق') || norm.includes('blue')) return '#3B82F6';
  if (norm.includes('كحلي') || norm.includes('navy')) return '#1E3A8A';
  if (norm.includes('سماوي') || norm.includes('cyan')) return '#38BDF8';
  if (norm.includes('اخضر') || norm.includes('green')) return '#10B981';
  if (norm.includes('زيتي') || norm.includes('olive')) return '#556B2F';
  if (norm.includes('اصفر') || norm.includes('yellow')) return '#EAB308';
  if (norm.includes('برتقالي') || norm.includes('orange')) return '#F97316';
  if (norm.includes('بيج') || norm.includes('beige')) return '#E5D3B3';
  if (norm.includes('بني') || norm.includes('brown')) return '#78350F';
  if (norm.includes('رمادي') || norm.includes('gray')) return '#9CA3AF';
  if (norm.includes('فضي') || norm.includes('silver')) return '#D1D5DB';
  if (norm.includes('ذهبي') || norm.includes('gold')) return '#D4AF37';
  if (norm.includes('بنفسجي') || norm.includes('purple')) return '#A855F7';

  return '#9CA3AF';
};

export default function Home() {
  const [storeName, setStoreName] = useState('متجر التحرير');
  const [liveStreamText, setLiveStreamText] = useState('بث مباشر كل 3 أيام');
  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'deals' | 'popular'>('all');

  const [currentSlide, setCurrentSlide] = useState(0);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartToast, setCartToast] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [step, setStep] = useState<'details' | 'checkout' | 'success'>('details');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('store_settings').select('key, value');
      if (data) {
        data.forEach((item) => {
          if (item.key === 'store_name' && item.value) {
            setStoreName(item.value);
          }
          if (item.key === 'live_stream_text' && item.value) {
            setLiveStreamText(item.value);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data: prods, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true);

    if (prodErr) {
      console.error('Error fetching products:', prodErr);
      setFetching(false);
      return;
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity');

    const salesCountMap: Record<string, number> = {};
    (orderItems || []).forEach((item) => {
      if (item.product_id) {
        salesCountMap[item.product_id] = (salesCountMap[item.product_id] || 0) + (item.quantity || 1);
      }
    });

    const fullProducts = await Promise.all(
      (prods || []).map(async (p) => {
        const { data: images } = await supabase
          .from('product_images')
          .select('image_url')
          .eq('product_id', p.id);

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, color, size, stock_quantity')
          .eq('product_id', p.id);

        return {
          ...p,
          sales_count: salesCountMap[p.id] || 0,
          product_images: images || [],
          product_variants: variants || [],
        };
      })
    );

    fullProducts.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
    setProducts(fullProducts as Product[]);
    setFetching(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchProducts();

    const channel = supabase
      .channel('client_sync_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
        fetchSettings();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, () => {
        fetchProducts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings, fetchProducts]);

  const discountProducts = useMemo(() => {
    return products.filter(
      (p) => p.original_price && Number(p.original_price) > Number(p.price)
    );
  }, [products]);

  useEffect(() => {
    if (discountProducts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % discountProducts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [discountProducts.length]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }

    if (activeCategory === 'deals') {
      list = list.filter((p) => p.original_price && Number(p.original_price) > Number(p.price));
    } else if (activeCategory === 'popular') {
      list = list.filter((p) => (p.sales_count || 0) > 0);
    }

    return list;
  }, [products, searchQuery, activeCategory]);

  const addToCart = (product: Product, variant: Variant | null, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => {
        const sameProduct = item.product.id === product.id;
        const sameVariant = (!item.variant && !variant) || item.variant?.id === variant?.id || item.variant?.color === variant?.color;
        return sameProduct && sameVariant;
      });

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      }

      return [...prevCart, { product, variant, quantity: 1 }];
    });

    setCartToast(`تمت إضافة "${product.title}" إلى السلة`);
    setTimeout(() => {
      setCartToast(null);
    }, 2500);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(product.product_variants?.[0] || null);
    setStep('details');
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setStep('details');
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setMapsLink('');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('متصفحك لا يدعم تحديد الموقع الجغرافي.');
      return;
    }

    setMapsLink('loading');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapsLink(`https://www.google.com/maps?q=${latitude},${longitude}`);
        alert('تم تحديد موقعك بدقة بنجاح');
      },
      () => {
        setMapsLink('');
        alert('تعذر الوصول للموقع، يرجى كتابة العنوان يدوياً.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const currentProduct = selectedProduct;
    const currentVariant = selectedVariant;

    const itemsToOrder: CartItem[] = currentProduct
      ? [{ product: currentProduct, variant: currentVariant, quantity: 1 }]
      : [...cart];

    if (itemsToOrder.length === 0) {
      alert('لا توجد منتجات لإتمام الطلب.');
      setLoading(false);
      return;
    }

    const totalAmount = currentProduct ? currentProduct.price : cartTotal;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: name,
          customer_phone: phone,
          address: address,
          maps_link: mapsLink && mapsLink !== 'loading' ? mapsLink : null,
          notes: notes || null,
          total_amount: totalAmount,
        },
      ])
      .select()
      .single();

    if (orderError || !orderData) {
      alert('حدث خطأ أثناء حفظ الطلب، حاول مرة أخرى');
      setLoading(false);
      return;
    }

    const orderItemsInserts = itemsToOrder.map((item) => ({
      order_id: orderData.id,
      product_id: item.product.id,
      variant_id: item.variant?.id || null,
      quantity: item.quantity,
      price_at_purchase: item.product.price,
    }));

    await supabase.from('order_items').insert(orderItemsInserts);

    for (const item of itemsToOrder) {
      if (item.variant?.id) {
        const newStock = Math.max(0, (item.variant.stock_quantity || 0) - item.quantity);
        await supabase
          .from('product_variants')
          .update({ stock_quantity: newStock })
          .eq('id', item.variant.id);
      }
    }

    try {
      const rawImage = itemsToOrder[0]?.product?.product_images?.[0]?.image_url?.replace(/^["']+|["']+$/g, '').trim() || '';
      const itemsPayload = itemsToOrder.map((i) => ({
        title: i.product.title,
        variant: i.variant ? `${i.variant.color} (${i.variant.size})` : 'افتراضي',
        quantity: i.quantity,
        price: i.product.price,
      }));

      await fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          address: address,
          mapsLink: mapsLink && mapsLink !== 'loading' ? mapsLink : null,
          notes: notes || null,
          totalAmount: totalAmount,
          items: itemsPayload,
          imageUrl: rawImage,
        }),
      });
    } catch (err) {
      console.error('Notification error:', err);
    }

    if (!currentProduct) {
      setCart([]);
      setIsCartOpen(false);
    }

    setLoading(false);
    setStep('success');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 selection:bg-rose-500 selection:text-white font-sans antialiased" dir="rtl">
      
      {/* شريط الإشعار العلوي للتوست */}
      {cartToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/10 text-xs font-bold animate-in fade-in slide-in-from-top duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{cartToast}</span>
        </div>
      )}

      {/* الشريط الإعلاني العلوي الصغير */}
      <div className="bg-zinc-950 text-white text-[11px] font-bold py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>{liveStreamText}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-zinc-400 font-medium">
            <span>التوصيل متاح داخل محافضه ديالى</span>
            <span>الدفع عند الاستلام</span>
          </div>
        </div>
      </div>

      {/* الهيدر الرئيسي للمتجر */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          
          {/* اسم المتجر النصي فقط */}
          <div className="flex items-center">
            <span className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              {storeName}
            </span>
          </div>

          {/* شريط البحث المركزي */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن أي منتج أو مواصفات..."
                className="w-full bg-white text-xs font-bold text-zinc-900 rounded-full py-2.5 pr-10 pl-10 outline-none border border-zinc-300 focus:border-zinc-900 transition duration-200 shadow-2xs placeholder:text-zinc-400"
              />
              <svg className="w-4 h-4 text-zinc-400 absolute right-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3.5 p-0.5 text-zinc-400 hover:text-zinc-700 transition"
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* أيقونة السلة */}
          <div className="flex items-center">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-zinc-800 hover:text-black transition active:scale-95"
              aria-label="سلة المشتريات"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              
              {cart.reduce((total, item) => total + item.quantity, 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {cart.reduce((total, item) => total + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12">
        
        {/* البانر الترويجي التفاعلي للخصومات */}
        {discountProducts.length > 0 ? (
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white p-6 sm:p-12 shadow-2xl">
            {discountProducts.map((product, idx) => {
              const isActive = idx === currentSlide;
              const bannerImg = product.product_images?.[0]?.image_url?.replace(/^["']+|["']+$/g, '').trim() || 'https://placehold.co/600x600';

              if (!isActive) return null;

              return (
                <div
                  key={product.id}
                  className="relative z-10 flex flex-col-reverse lg:flex-row items-center justify-between gap-8 animate-in fade-in duration-500"
                >
                  <div className="space-y-4 max-w-xl text-center lg:text-right">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-bold text-rose-300">
                      <span>عرض خاص متوفر الآن</span>
                    </div>

                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                      {product.title}
                    </h2>

                    <p className="text-zinc-300 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="flex items-center justify-center lg:justify-start gap-4 pt-2">
                      <span className="text-3xl sm:text-4xl font-black text-white" dir="ltr">
                        ${product.price}
                      </span>
                      {product.original_price && Number(product.original_price) > Number(product.price) && (
                        <span className="text-lg text-zinc-500 line-through font-bold" dir="ltr">
                          ${product.original_price}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-4">
                      <button
                        onClick={() => handleOpenProduct(product)}
                        className="bg-white text-zinc-950 hover:bg-zinc-100 text-xs sm:text-sm font-black px-8 py-3.5 rounded-full transition active:scale-95 shadow-lg"
                      >
                        طلب الآن
                      </button>
                      <button
                        onClick={(e) => addToCart(product, product.product_variants?.[0] || null, e)}
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-bold px-6 py-3.5 rounded-full transition active:scale-95"
                      >
                        + إضافة للسلة
                      </button>
                    </div>
                  </div>

                  <div className="w-56 h-56 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl bg-zinc-800/50 p-2 border border-white/10 shrink-0">
                    <img
                      src={bannerImg}
                      alt={product.title}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/600x600?text=Product';
                      }}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  </div>
                </div>
              );
            })}

            {/* أزرار ونقاط التنقل في البانر */}
            {discountProducts.length > 1 && (
              <div className="relative z-10 flex items-center justify-between mt-8 pt-4 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  {discountProducts.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/30'
                      }`}
                      aria-label={`الشريحة ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + discountProducts.length) % discountProducts.length)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition"
                    aria-label="السابق"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % discountProducts.length)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition"
                    aria-label="التالي"
                  >
                    ←
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : products.length > 0 ? (
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white p-6 sm:p-12 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-lg text-center sm:text-right">
              <span className="text-rose-400 text-xs font-bold tracking-wider block">
                {liveStreamText}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black leading-tight">
                تشكيلة {storeName} المميزة
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm">
                اطلب منتجاتك المفضلة بأسهل طريقة، والدفع نقداً عند استلام شحنتك.
              </p>
            </div>
            <div className="w-48 sm:w-64 h-48 sm:h-56 rounded-2xl overflow-hidden shadow-2xl shrink-0">
              <img
                src={products[0]?.product_images?.[0]?.image_url || 'https://placehold.co/600x600'}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </section>
        ) : null}

        {/* فلاتر التصنيفات وشريط البحث في الموبايل */}
        <section className="space-y-4">
          <div className="block md:hidden">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن أي منتج أو مواصفات..."
                className="w-full bg-white text-xs font-bold text-zinc-900 rounded-full py-3 pr-10 pl-10 outline-none border border-zinc-300 focus:border-zinc-900 transition duration-200 shadow-2xs placeholder:text-zinc-400"
              />
              <svg className="w-4 h-4 text-zinc-400 absolute right-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3.5 p-0.5 text-zinc-400 hover:text-zinc-700 transition"
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                  activeCategory === 'all'
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
                }`}
              >
                جميع المنتجات ({products.length})
              </button>
              <button
                onClick={() => setActiveCategory('deals')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                  activeCategory === 'deals'
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
                }`}
              >
                العروض والخصومات
              </button>
              <button
                onClick={() => setActiveCategory('popular')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
                  activeCategory === 'popular'
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
                }`}
              >
                الأكثر طلباً
              </button>
            </div>

            <span className="text-xs text-zinc-400 font-medium">
              عرض {filteredProducts.length} منتج
            </span>
          </div>
        </section>

        {/* شبكة المنتجات (عمودين على الهاتف grid-cols-2) */}
        <section>
          {fetching ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="bg-white rounded-3xl h-72 sm:h-80 border border-zinc-200/60 animate-pulse p-3 sm:p-4 space-y-3">
                  <div className="bg-zinc-100 rounded-2xl h-36 sm:h-44 w-full" />
                  <div className="h-3.5 bg-zinc-100 rounded-md w-3/4" />
                  <div className="h-3.5 bg-zinc-100 rounded-md w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-zinc-200/80 space-y-2">
              <h3 className="text-base font-black text-zinc-900">لا توجد منتجات مطابقة للبحث</h3>
              <p className="text-xs text-zinc-400">جرب البحث بكلمات أخرى أو تصفح كل المنتجات</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {filteredProducts.map((p) => {
                const rawImg = p.product_images?.[0]?.image_url?.replace(/^["']+|["']+$/g, '').trim();
                const img = rawImg && rawImg.startsWith('http') ? rawImg : 'https://placehold.co/400x400?text=Product';
                const hasDiscount = Boolean(p.original_price && Number(p.original_price) > Number(p.price));

                return (
                  <div
                    key={p.id}
                    className="bg-white border border-zinc-200/80 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 flex flex-col justify-between hover:border-zinc-300 hover:shadow-xl transition-all duration-300 group"
                  >
                    <div>
                      {/* حاوية صورة المنتج */}
                      <div 
                        onClick={() => handleOpenProduct(p)}
                        className="relative aspect-square rounded-xl sm:rounded-2xl bg-[#F8F9FA] overflow-hidden flex items-center justify-center mb-2.5 sm:mb-4 cursor-pointer"
                      >
                        <img
                          src={img}
                          alt={p.title}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=No+Image';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {hasDiscount && (
                          <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-rose-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl shadow-xs">
                            خصم
                          </span>
                        )}
                      </div>

                      {/* عنوان وتفاصيل المنتج */}
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 
                            onClick={() => handleOpenProduct(p)}
                            className="font-black text-xs sm:text-sm text-zinc-900 line-clamp-1 hover:text-rose-600 transition cursor-pointer"
                          >
                            {p.title}
                          </h4>
                          <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                            متوفر
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-zinc-400 line-clamp-1">{p.description}</p>
                      </div>

                      {/* قائمة الألوان */}
                      <div className="flex items-center gap-1 sm:gap-1.5 my-2 sm:my-3">
                        {p.product_variants?.slice(0, 4).map((v, i) => (
                          <span
                            key={i}
                            style={{ backgroundColor: getColorHex(v.color) }}
                            className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border border-zinc-300 shadow-2xs inline-block"
                            title={v.color}
                          />
                        ))}
                      </div>

                      {/* السعر */}
                      <div className="flex items-baseline gap-1.5 sm:gap-2 mb-2.5 sm:mb-4">
                        <span className="text-sm sm:text-base font-black text-zinc-950">${p.price}</span>
                        {hasDiscount && (
                          <span className="text-[10px] sm:text-xs text-zinc-400 line-through font-bold">
                            ${p.original_price}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* أزرار الإجراءات */}
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-2 border-t border-zinc-100">
                      <button
                        onClick={() => handleOpenProduct(p)}
                        className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-[10px] sm:text-xs font-black py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition active:scale-95 shadow-xs"
                      >
                        طلب الآن
                      </button>
                      <button
                        onClick={(e) => addToCart(p, p.product_variants?.[0] || null, e)}
                        className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition active:scale-95"
                      >
                        + السلة
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* سلة المشتريات الجانبية */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-300 text-right">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
                <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                  <span>سلة المشتريات</span>
                  <span className="text-xs bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold">
                    {cart.length} منتجات
                  </span>
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-zinc-400 hover:text-zinc-900 p-2 text-base font-bold"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 space-y-2">
                  <p className="text-xs font-bold">سلة المشتريات فارغة حالياً</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
                  {cart.map((item, index) => (
                    <div
                      key={index}
                      className="bg-zinc-50 p-3 rounded-2xl flex items-center justify-between border border-zinc-100 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product.product_images?.[0]?.image_url?.replace(/^["']+|["']+$/g, '').trim()}
                          className="w-12 h-12 object-cover rounded-xl bg-white border border-zinc-200"
                          alt=""
                        />
                        <div>
                          <h4 className="font-black text-zinc-900 line-clamp-1">{item.product.title}</h4>
                          <span className="text-[10px] text-zinc-400">
                            {item.variant ? item.variant.color : 'افتراضي'}
                          </span>
                          <span className="font-black text-zinc-900 block mt-0.5">${item.product.price * item.quantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-zinc-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(index, -1)}
                            className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-black transition active:scale-90 text-xs"
                            title="تقليل الكمية"
                          >
                            -
                          </button>
                          <span className="px-1 text-xs font-black min-w-4 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(index, 1)}
                            className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 flex items-center justify-center font-black transition active:scale-90 text-xs"
                            title="زيادة الكمية"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(index)}
                          className="text-zinc-400 hover:text-rose-600 font-bold p-1 transition"
                          title="حذف"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <div className="flex justify-between items-center text-sm font-black">
                  <span>المجموع الإجمالي:</span>
                  <span className="text-xl text-zinc-950">${cartTotal}</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setStep('checkout');
                    setIsCartOpen(false);
                  }}
                  className="w-full bg-zinc-950 text-white py-3.5 rounded-2xl font-black hover:bg-black transition active:scale-95 shadow-md"
                >
                  إتمام طلب السلة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة تفاصيل المنتج ونموذج الشراء */}
      {(selectedProduct || step === 'checkout' || step === 'success') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl relative text-right">
            
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
              <span className="text-xs font-black text-zinc-400">
                {step === 'details' ? 'تفاصيل المنتج' : step === 'checkout' ? 'معلومات التوصيل' : 'تم الطلب'}
              </span>
              <button
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-zinc-900 bg-zinc-100 rounded-full w-8 h-8 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* خطوة تفاصيل المنتج */}
            {step === 'details' && selectedProduct && (
              <div className="space-y-5">
                <div className="relative aspect-video rounded-2xl bg-zinc-50 overflow-hidden border border-zinc-100">
                  <img
                    src={selectedProduct.product_images?.[0]?.image_url?.replace(/^["']+|["']+$/g, '').trim()}
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-black text-zinc-900 leading-snug">
                      {selectedProduct.title}
                    </h2>
                    <span className="text-2xl font-black text-zinc-950 shrink-0">${selectedProduct.price}</span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">{selectedProduct.description}</p>
                </div>

                {selectedProduct.product_variants?.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    <span className="text-xs font-black text-zinc-700 block">اختر اللون:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.product_variants.map((v) => {
                        const isSelected = selectedVariant?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariant(v)}
                            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${
                              isSelected
                                ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400'
                            }`}
                          >
                            <span
                              style={{ backgroundColor: getColorHex(v.color) }}
                              className="w-2.5 h-2.5 rounded-full border border-white"
                            />
                            <span>{v.color}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button
                    type="button"
                    onClick={(e) => addToCart(selectedProduct, selectedVariant, e)}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-black py-3.5 rounded-xl transition"
                  >
                    + إضافة للسلة
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('checkout')}
                    className="bg-zinc-950 hover:bg-black text-white text-xs font-black py-3.5 rounded-xl transition shadow-md active:scale-95"
                  >
                    طلب الآن
                  </button>
                </div>
              </div>
            )}

            {/* خطوة إدخال بيانات التوصيل */}
            {step === 'checkout' && (
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/70 flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-900">
                    {selectedProduct ? `طلب: ${selectedProduct.title}` : `طلب سلة المشتريات (${cart.length} قطع)`}
                  </span>
                  <span className="font-black text-zinc-950 text-base">
                    ${selectedProduct ? selectedProduct.price : cartTotal}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اكتب اسم المستلم..."
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0770..."
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="المحافظة، المنطقة، أقرب نقطة دالة..."
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={mapsLink === 'loading'}
                    className={`w-full py-3 rounded-xl text-xs font-bold border transition ${
                      mapsLink && mapsLink !== 'loading'
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : mapsLink === 'loading'
                        ? 'bg-zinc-200 text-zinc-500 border-zinc-300'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {mapsLink === 'loading'
                      ? 'جاري تحديد موقعك...'
                      : mapsLink
                      ? '✓ تم تحديد موقعك على الخريطة'
                      : 'مشاركة موقعي الجغرافي (GPS)'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">ملاحظات إضافية (اختياري)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي توجيهات لمندوب التوصيل..."
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-zinc-950 hover:bg-black text-white text-xs font-black py-4 rounded-2xl transition disabled:opacity-50 shadow-md active:scale-95 mt-2"
                >
                  {loading ? 'جاري تأكيد الطلب...' : 'تأكيد الطلب (الدفع عند الاستلام)'}
                </button>
              </form>
            )}

            {/* خطوة نجاح الطلب */}
            {step === 'success' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black border border-emerald-200">
                  ✓
                </div>
                <h3 className="text-xl font-black text-zinc-900">تم استلام طلبك بنجاح!</h3>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                  شكراً لتسوقك معنا. سيتم التواصل معك عبر الهاتف لتأكيد التوصيل في أقرب وقت.
                </p>
                <button
                  onClick={handleCloseModal}
                  className="w-full bg-zinc-950 text-white text-xs font-bold py-3.5 rounded-xl hover:bg-black transition shadow-xs"
                >
                  العودة للتسوق
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}