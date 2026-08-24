
import { createClient } from '../src/utils/supabase/server';

async function testQuery() {
  try {
    const supabase = await createClient();
    
    console.log('Testing milk_production...');
    const milkRes = await supabase
      .from('milk_production')
      .select('production_date, quantity_liters')
      .limit(1);
    
    if (milkRes.error) {
      console.error('Milk Error:', milkRes.error);
    } else {
      console.log('Milk Success:', milkRes.data);
    }

    console.log('Testing egg_production...');
    const eggRes = await supabase
      .from('egg_production')
      .select('production_date, quantity_units, discarded_units')
      .limit(1);
      
    if (eggRes.error) {
      console.error('Egg Error:', eggRes.error);
    } else {
      console.log('Egg Success:', eggRes.data);
    }
  } catch (err) {
    console.error('Catch Error:', err);
  }
}

testQuery();
