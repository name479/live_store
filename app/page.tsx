'use client';

import { useEffect, useState, useCallback } from 'react';
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
  if (norm.includes('وردي') || norm.includes('زهري') || norm.includes('بينك') || norm.includes('pink')) return '#F472B6';
  if (norm.includes('ازرق') || norm.includes('blue') || norm.includes('نيلي')) return '#3B82F6';
  if (norm.includes('كحلي') || norm.includes('navy')) return '#1E3A8A';
  if (norm.includes('سماوي') || norm.includes('cyan')) return '#38BDF8';
  if (norm.includes('اخضر') || norm.includes('green')) return '#10B981';
  if (norm.includes('زيتي') || norm.includes('olive')) return '#556B2F';
  if (norm.includes('اصفر') || norm.includes('yellow')) return '#EAB308';
  if (norm.includes('برتقالي') || norm.includes('orange')) return '#F97316';
  if (norm.includes('بيج') || norm.includes('سكري') || norm.includes('beige')) return '#E5D3B3';
  if (norm.includes('بني') || norm.includes('brown')) return '#78350F';
  if (norm.includes('رمادي') || norm.includes('رصاصي') || norm.includes('gray') || norm.includes('grey')) return '#9CA3AF';
  if (norm.includes('فضي') || norm.includes('silver')) return '#D1D5DB';
  if (norm.includes('ذهبي') || norm.includes('gold')) return '#D4AF37';
  if (norm.includes('بنفسجي') || norm.includes('ارجواني') || norm.includes('purple')) return '#A855F7';

  return '#9CA3AF';
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [liveStreamText, setLiveStreamText] = useState('بث مباشر كل 3 أيام');
  const [fetching, setFetching] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'live_stream_text')
      .single();

    if (data?.value) {
      setLiveStreamText(data.value);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchSettings();

    const channel = supabase
      .channel('public_realtime_all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => fetchProducts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_images' },
        () => fetchProducts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants' },
        () => fetchProducts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => fetchProducts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_settings' },
        (payload) => {
          const updated = payload.new as { key?: string; value?: string };
          if (updated && updated.key === 'live_stream_text' && updated.value) {
            setLiveStreamText(updated.value);
          } else {
            fetchSettings();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts, fetchSettings]);

  const discountProducts = products.filter(
    (p) => p.original_price && Number(p.original_price) > Number(p.price)
  );

  useEffect(() => {
    if (discountProducts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % discountProducts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [discountProducts.length]);

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
        const { latitude, longitude, accuracy } = position.coords;
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setMapsLink(url);
        alert(`تم التقاط موقعك الفعلي بدقة (هامش خطأ: ${Math.round(accuracy)} متر)`);
      },
      (error) => {
        setMapsLink('');
        if (error.code === error.PERMISSION_DENIED) {
          alert('يرجى السماح بصلاحية الوصول للموقع في إعدادات المتصفح.');
        } else {
          alert('تعذر جلب إحداثيات دقيقة، يرجى كتابة العنوان يدوياً.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
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
      alert('لا توجد منتجات محددة لإتمام الطلب.');
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

    // استخراج رابط الصورة والتأكد من أنه رابط كامل (Public URL)
    try {
      const rawImage = itemsToOrder[0]?.product?.product_images?.[0]?.image_url || '';
      let finalImageUrl = rawImage;

      if (rawImage && !rawImage.startsWith('http')) {
        const { data } = supabase.storage.from('products').getPublicUrl(rawImage);
        finalImageUrl = data.publicUrl;
      }

      const itemsPayload = itemsToOrder.map((i) => ({
        title: i.product.title,
        variant: i.variant ? `${i.variant.color} (${i.variant.size})` : 'افتراضي',
        quantity: i.quantity,
        price: i.product.price,
      }));

      await fetch('/api/telegram-notify', {
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
          imageUrl: finalImageUrl,
        }),
      });
    } catch (err) {
      console.error('Telegram notification error:', err);
    }

    if (!currentProduct) {
      setCart([]);
      setIsCartOpen(false);
    }

    setLoading(false);
    setStep('success');
  };

  const displayedProducts = showAll ? products : products.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] selection:bg-black selection:text-white relative" dir="rtl">
      
      {/* Toast الإشعار السريع */}
      {cartToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-gray-800 animate-in fade-in slide-in-from-top duration-200">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="text-xs font-bold">{cartToast}</span>
        </div>
      )}

      {/* 1. Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="relative flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setMenuOpen(!menuOpen)} 
              className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-700"
              aria-label="القائمة"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* شريط البث المباشر */}
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <span className="bg-red-500 text-white text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full tracking-wider">
                {liveStreamText}
              </span>
            </div>

            {menuOpen && (
              <div className="absolute top-12 right-0 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <a 
                  href="#" 
                  onClick={() => setMenuOpen(false)} 
                  className="block px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-black transition"
                >
                  الرئيسية
                </a>
                <a 
                  href="#trending" 
                  onClick={() => { setMenuOpen(false); setShowAll(false); }} 
                  className="block px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-black transition"
                >
                  الأكثر طلباً
                </a>
                <a 
                  href="#all-products" 
                  onClick={() => { setMenuOpen(false); setShowAll(true); }} 
                  className="block px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-black transition"
                >
                  جميع المنتجات
                </a>
              </div>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">
            متجر التحرير
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative cursor-pointer p-2 rounded-xl hover:bg-gray-100 transition"
              aria-label="سلة التسوق"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-800">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="absolute top-1 left-1 bg-black text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cart.reduce((total, item) => total + item.quantity, 0)}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. المحتوى الرئيسي */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* البانر التفاعلي للتخفيضات */}
        <section className="mb-8 sm:mb-12">
          {discountProducts.length === 0 ? (
            <div className="bg-[#0C0C0C] text-white rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="relative z-10 max-w-lg">
                <span className="text-[#FF9F92] text-xs font-bold tracking-widest block mb-2">
                  🔴 {liveStreamText}
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold leading-tight mb-3">
                  تشكيلة متجر التحرير المميزة
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm mb-6 leading-relaxed">
                  اطلب منتجاتك المفضلة بأسهل طريقة، والدفع نقداً عند استلام شحنتك.
                </p>
                <button 
                  onClick={() => setShowAll(true)}
                  className="bg-white text-black text-xs sm:text-sm font-bold px-7 py-3.5 rounded-full hover:bg-gray-100 transition shadow-sm active:scale-95"
                >
                  تصفح جميع المنتجات
                </button>
              </div>

              <div className="relative z-10 hidden sm:block w-48 sm:w-64 h-48 sm:h-56 rounded-2xl overflow-hidden shadow-2xl shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600" 
                  alt="منتج مميز" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            </div>
          ) : (
            <div className="bg-[#0C0C0C] text-white rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden shadow-xl">
              {discountProducts.map((product, idx) => {
                const isActive = idx === currentSlide;
                const bannerImg = product.product_images?.[0]?.image_url || 'https://via.placeholder.com/600';

                if (!isActive) return null;

                return (
                  <div
                    key={product.id}
                    className="relative z-10 flex flex-col-reverse md:flex-row items-center justify-between gap-6 sm:gap-10 animate-in fade-in duration-500"
                  >
                    <div className="flex-1 w-full text-right space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-red-600 text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                          عرض لفترة محدودة 🔥
                        </span>
                        {product.sales_count && product.sales_count > 0 ? (
                          <span className="text-gray-400 text-xs font-medium">تم بيع {product.sales_count} قطعة</span>
                        ) : null}
                      </div>

                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-tight text-white">
                        {product.title}
                      </h2>

                      <p className="text-gray-400 text-xs sm:text-sm line-clamp-2 leading-relaxed max-w-xl">
                        {product.description}
                      </p>

                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-2xl sm:text-4xl font-black text-white" dir="ltr">
                          ${product.price}
                        </span>
                        <span className="text-base sm:text-lg font-bold text-gray-500 line-through" dir="ltr">
                          ${product.original_price}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-3">
                        <button
                          onClick={() => handleOpenProduct(product)}
                          className="bg-white text-black text-xs sm:text-sm font-extrabold px-8 py-3.5 rounded-full hover:bg-gray-100 active:scale-95 transition shadow-lg"
                        >
                          طلب فوري الآن
                        </button>
                        <button
                          onClick={(e) => addToCart(product, product.product_variants?.[0] || null, e)}
                          className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-bold px-6 py-3.5 rounded-full active:scale-95 transition"
                        >
                          + السلة
                        </button>
                      </div>
                    </div>

                    <div className="w-full md:w-80 h-64 md:h-80 rounded-3xl overflow-hidden shadow-2xl shrink-0 relative">
                      <img
                        src={bannerImg}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3.5 right-3.5 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-xl shadow-md">
                        خصم
                      </span>
                    </div>
                  </div>
                );
              })}

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
            </div>
          )}
        </section>

        {/* شبكة المنتجات */}
        <section id="trending">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-xl sm:text-2xl text-gray-900 tracking-tight">
                {showAll ? 'جميع المنتجات' : 'الأكثر طلباً الآن 🔥'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {showAll ? `عرض جميع المنتجات المتاحة (${products.length})` : 'أبرز المنتجات التي تم شراؤها فعلياً'}
              </p>
            </div>

            <button 
              onClick={() => setShowAll(!showAll)} 
              className="text-xs sm:text-sm font-bold text-gray-600 border border-gray-200 px-4 py-2 rounded-full hover:border-black hover:text-black transition"
            >
              {showAll ? 'عرض الأكثر طلباً فقط' : 'عرض الكل'}
            </button>
          </div>

          {fetching ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-gray-200/70 rounded-3xl h-72 animate-pulse" />
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="text-center py-20 text-gray-400 font-medium">
              لا توجد منتجات متوفرة حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {displayedProducts.map((p) => {
                const img = p.product_images?.[0]?.image_url || 'https://via.placeholder.com/400';
                const hasDiscount = Boolean(p.original_price && Number(p.original_price) > Number(p.price));

                return (
                  <div
                    key={p.id}
                    className="bg-white border border-gray-100 rounded-3xl p-3 sm:p-4 flex flex-col justify-between group transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="relative aspect-square rounded-2xl bg-[#F8F9FA] overflow-hidden flex items-center justify-center mb-3">
                      <img
                        src={img}
                        alt={p.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                      {hasDiscount && (
                        <span className="absolute top-2.5 right-2.5 bg-[#FF3B30] text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-sm">
                          خصم
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm sm:text-base text-gray-900 truncate">{p.title}</h4>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mr-1" />
                      </div>

                      <div className="flex items-center gap-1.5 my-2">
                        {p.product_variants && p.product_variants.length > 0 ? (
                          p.product_variants.slice(0, 5).map((v, i) => {
                            const colorHex = getColorHex(v.color);
                            return (
                              <span
                                key={i}
                                style={{ backgroundColor: colorHex }}
                                className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-2xs inline-block"
                                title={v.color}
                              />
                            );
                          })
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-black border border-gray-300 inline-block" />
                        )}
                      </div>

                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-base sm:text-lg font-extrabold text-black">${p.price}</span>
                        {hasDiscount && (
                          <span className="text-xs text-gray-400 line-through">
                            ${p.original_price}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenProduct(p)}
                      className="w-full bg-[#111111] text-white text-xs font-bold py-3 rounded-full tracking-wider hover:bg-black active:scale-95 transition-all shadow-sm"
                    >
                      طلب فوري
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!showAll && products.length > 4 && (
            <div className="mt-12 flex justify-center">
              <button 
                onClick={() => setShowAll(true)} 
                className="border border-gray-300 bg-white text-gray-800 text-xs sm:text-sm font-bold px-8 py-3 rounded-full hover:bg-gray-50 active:scale-95 transition shadow-sm"
              >
                تحميل المزيد ({products.length - 4} منتجات إضافية)
              </button>
            </div>
          )}
        </section>
      </main>

      {/* سلة المشتريات الجانبية */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-300">
            <div>
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <span>سلة التسوق</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-bold">
                    {cart.length} منتجات
                  </span>
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-gray-400 hover:text-black p-2 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="text-4xl mb-2">🛍️</div>
                  <p className="text-sm font-bold">السلة فارغة حالياً</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
                  {cart.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 p-3 rounded-2xl flex items-center justify-between border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product.product_images?.[0]?.image_url}
                          className="w-14 h-14 object-cover rounded-xl bg-white"
                          alt=""
                        />
                        <div>
                          <h4 className="font-bold text-xs text-gray-900 line-clamp-1">{item.product.title}</h4>
                          <span className="text-[11px] text-gray-500">
                            {item.variant ? item.variant.color : 'افتراضي'}
                          </span>
                          <span className="text-xs font-black text-black block mt-0.5">${item.product.price * item.quantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden">
                          <button
                            onClick={() => updateCartQuantity(index, -1)}
                            className="px-2.5 py-1 text-xs font-black text-gray-600 hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-black text-black">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(index, 1)}
                            className="px-2.5 py-1 text-xs font-black text-gray-600 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-xs text-gray-400 hover:text-black font-bold p-1.5"
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
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center text-base font-black">
                  <span>المجموع الكلي:</span>
                  <span className="text-xl text-black">${cartTotal}</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setStep('checkout');
                    setIsCartOpen(false);
                  }}
                  className="w-full bg-black text-white py-3.5 rounded-2xl font-bold hover:bg-gray-800 transition"
                >
                  إتمام طلب السلة (${cartTotal})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة تفاصيل المنتج والطلب */}
      {(selectedProduct || step === 'checkout' || step === 'success') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 transition-opacity duration-300">
          <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl relative animate-in fade-in slide-in-from-bottom duration-300">
            
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto sm:hidden" />
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-full w-9 h-9 flex items-center justify-center font-bold text-sm transition shadow-sm mr-auto"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* 1. تفاصيل المنتج */}
            {step === 'details' && selectedProduct && (
              <div className="space-y-6">
                <div className="relative aspect-video rounded-2xl bg-gray-50 overflow-hidden shadow-inner">
                  <img
                    src={selectedProduct.product_images?.[0]?.image_url || 'https://via.placeholder.com/600'}
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                  {selectedProduct.original_price && Number(selectedProduct.original_price) > Number(selectedProduct.price) && (
                    <span className="absolute top-3 right-3 bg-[#FF3B30] text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md">
                      خصم
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 leading-tight">
                      {selectedProduct.title}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="text-3xl font-black text-gray-900">${selectedProduct.price}</span>
                    {selectedProduct.original_price && Number(selectedProduct.original_price) > Number(selectedProduct.price) && (
                      <span className="text-sm font-bold text-gray-400 line-through block mt-0.5">
                        ${selectedProduct.original_price}
                      </span>
                    )}
                  </div>
                </div>

                {selectedProduct.product_variants?.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <span className="text-xs font-black text-gray-400 block mb-3">
                      اللون / الخيار المحدد: <span className="text-black font-bold">{selectedVariant?.color || 'اختر الخيار'}</span>
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedProduct.product_variants.map((v) => {
                        const isSelected = selectedVariant?.id === v.id;
                        const vColorHex = getColorHex(v.color);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariant(v)}
                            className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-all flex items-center gap-2 ${
                              isSelected
                                ? 'border-black bg-black text-white shadow-md'
                                : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400'
                            }`}
                          >
                            <span
                              style={{ backgroundColor: vColorHex }}
                              className="w-3 h-3 rounded-full border border-gray-300 inline-block"
                            />
                            <span>{v.color}</span>
                            <span className="text-xs opacity-60 font-normal">({v.size})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={(e) => addToCart(selectedProduct, selectedVariant, e)}
                    className="w-1/3 bg-gray-100 text-gray-900 font-bold py-4 rounded-2xl hover:bg-gray-200 transition"
                  >
                    اضافة الى السلة
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('checkout')}
                    className="w-2/3 bg-black text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-98 transition shadow-lg"
                  >
                    <span>طلب مباشر</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. نموذج إتمام الطلب */}
            {step === 'checkout' && (
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setStep('details')}
                    className="text-xs font-bold text-gray-400 hover:text-black"
                  >
                    → العودة لتفاصيل المنتج
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                  <span className="font-bold text-sm text-gray-900">
                    {selectedProduct ? `طلب: ${selectedProduct.title}` : `طلب سلة المشتريات (${cart.length} منتجات)`}
                  </span>
                  <span className="text-lg font-black text-black">
                    ${selectedProduct ? selectedProduct.price : cartTotal}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">الاسم الثلاثي</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اكتب اسمك الكامل"
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition text-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07700000000"
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition text-right text-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="المحافظة، المنطقة، أقرب نقطة دالة"
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition text-black"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={mapsLink === 'loading'}
                    className={`w-full py-3.5 rounded-xl text-xs font-bold border transition-all duration-200 text-center ${
                      mapsLink && mapsLink !== 'loading'
                        ? 'bg-black text-white border-black shadow-sm'
                        : mapsLink === 'loading'
                        ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-wait'
                        : 'bg-gray-50 text-gray-900 border-gray-200 hover:border-black hover:bg-gray-100'
                    }`}
                  >
                    {mapsLink === 'loading'
                      ? 'جاري الاتصال بالأقمار الصناعية وتحديد موقعك بدقة...'
                      : mapsLink
                      ? 'تم تحديد موقعك الجغرافي بدقة (اضغط للتحديث)'
                      : 'مشاركة موقعي الجغرافي الحالي (GPS)'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات إضافية للمندوب (اختياري)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: الاتصال قبل الوصول بنصف ساعة"
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition text-black"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-4 rounded-2xl font-extrabold hover:bg-gray-800 active:scale-98 transition shadow-xl disabled:opacity-50 mt-4"
                >
                  {loading ? 'جاري تأكيد الطلب...' : 'تأكيد الطلب الآن (الدفع عند الاستلام)'}
                </button>
              </form>
            )}

            {/* 3. نجاح الطلب */}
            {step === 'success' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-gray-100 text-black rounded-full flex items-center justify-center mx-auto text-3xl font-black">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-gray-900">تم استلام طلبك بنجاح!</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                  شكراً لطلبك من متجر التحرير. سيتواصل معك المندوب هاتفياً لتسليم الشحنة في أقرب وقت.
                </p>
                <button
                  onClick={handleCloseModal}
                  className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition"
                >
                  العودة للمتجر
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}