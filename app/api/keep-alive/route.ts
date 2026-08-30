import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // استعلام خفيف جداً يطلب صفاً واحداً لتنشيط قاعدة البيانات
    const { data, error } = await supabase
      .from('store_settings')
      .select('key')
      .limit(1);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Supabase pinged successfully', 
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 });
  }
}