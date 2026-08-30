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
      imageUrl,
    } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Telegram credentials missing' }, { status: 500 });
    }

    let itemsText = '';
    if (Array.isArray(items) && items.length > 0) {
      itemsText = items
        .map(
          (item: { title?: string; variant?: string; quantity?: number; price?: number }) =>
            `• ${item.title || 'منتج'}\n  الخيار: ${item.variant || 'افتراضي'} | الكمية: ${item.quantity || 1} | السعر: $${(item.price || 0) * (item.quantity || 1)}`
        )
        .join('\n\n');
    } else {
      itemsText = `• طلب جديد بمبلغ $${totalAmount}`;
    }

    const locationText =
      mapsLink && mapsLink !== 'loading'
        ? `[اضغط هنا لفتح الموقع بالخريطة](${mapsLink})`
        : 'غير محدد';

    const message = `طلب شراء جديد - متجر التحرير
━━━━━━━━━━━━━━━━━━━━

معلومات الزبون:
الاسم: ${customerName}
رقم الهاتف: \`${customerPhone}\`
العنوان: ${address}
الموقع الجغرافي: ${locationText}
الملاحظات: ${notes ? notes : 'لا توجد'}

━━━━━━━━━━━━━━━━━━━━
تفاصيل الطلب:
${itemsText}

━━━━━━━━━━━━━━━━━━━━
المبلغ الإجمالي: $${totalAmount}`;

    // 1. إرسال الصورة مباشرة إلى تيليجرام
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      console.log('Sending Image URL to Telegram:', imageUrl);
      try {
        const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: encodeURI(imageUrl),
          }),
        });

        const photoJson = await photoRes.json();
        if (!photoJson.ok) {
          console.error('Telegram Photo API Error:', photoJson);
        }
      } catch (photoErr) {
        console.error('Photo fetch error:', photoErr);
      }
    } else {
      console.log('No valid image URL provided:', imageUrl);
    }

    // 2. إرسال نص وتفاصيل الطلب
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram route fatal error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}