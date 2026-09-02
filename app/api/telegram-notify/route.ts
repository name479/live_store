import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      address,
      mapsLink,
      notes,
      totalAmount,
      items,
      imageUrls,
      imageUrl,
    } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram credentials missing in environment variables');
      return NextResponse.json({ error: 'Telegram credentials missing' }, { status: 500 });
    }

    // تجميع وتصفية روابط الصور
    let validImages: string[] = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      validImages = imageUrls.filter((u) => typeof u === 'string' && u.startsWith('http'));
    } else if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      validImages = [imageUrl];
    }
    validImages = Array.from(new Set(validImages));

    // بناء نص تفاصيل الطلب
    let itemsText = '';
    if (Array.isArray(items) && items.length > 0) {
      itemsText = items
        .map(
          (item: { title?: string; variant?: string; quantity?: number; price?: number }, idx: number) =>
            `${idx + 1}. ${item.title || 'منتج'}\n   الخيار: ${item.variant || 'افتراضي'} | الكمية: ${item.quantity || 1} | السعر: $${(item.price || 0) * (item.quantity || 1)}`
        )
        .join('\n\n');
    } else {
      itemsText = `• طلب جديد بمبلغ $${totalAmount}`;
    }

    const locationText = mapsLink && mapsLink !== 'loading' ? mapsLink : 'غير محدد';

    const message = `🛍️ طلب شراء جديد
━━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${customerName}
📞 الهاتف: ${customerPhone}
📍 العنوان: ${address}
🗺️ الموقع: ${locationText}
📝 ملاحظات: ${notes ? notes : 'لا توجد'}

━━━━━━━━━━━━━━━━━━━━
📦 تفاصيل الطلب:
${itemsText}

━━━━━━━━━━━━━━━━━━━━
💰 المبلغ الإجمالي: $${totalAmount}`.trim();

    // 1. إرسال الرسالة النصية فوراً (مضمونة بنسبة 100% ولا تتأثر بحجم أو روابط الصور)
    const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: false,
      }),
    });

    const textResult = await textRes.json();
    if (!textResult.ok) {
      console.error('Telegram SendMessage Failed:', textResult);
      return NextResponse.json({ error: textResult.description }, { status: 500 });
    }

    // 2. إرسال صور المنتجات التابعة للطلب
    if (validImages.length > 1) {
      // إرسال ألبوم صور مجمّع
      const media = validImages.slice(0, 10).map((url) => ({
        type: 'photo',
        media: url,
      }));

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            media: media,
          }),
        });
      } catch (mediaErr) {
        console.warn('Media group delivery error:', mediaErr);
      }
    } else if (validImages.length === 1) {
      // إرسال صورة واحدة
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: validImages[0],
          }),
        });
      } catch (photoErr) {
        console.warn('Single photo delivery error:', photoErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Fatal Telegram Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}