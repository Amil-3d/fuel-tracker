// Drinks every dining hall pours, which the dining menus don't list.
// One serving is what you actually drink from one dining hall cup or mug:
// cold drinks fill a 16 oz cup with ice, which leaves about 12 fl oz of drink;
// coffee, tea and hot chocolate fill a dining hall mug, about 10 fl oz.
// Nutrition is per serving, from USDA FoodData Central and typical fountain brands.
export const CUP_OZ = 12;
export const MUG_OZ = 10;

const COLD = `1 glass (${CUP_OZ} fl oz)`;
const HOT = `1 mug (${MUG_OZ} fl oz)`;
const d = (id, name, serving, kcal, protein, carbs, fat, sugar, sodium, extra = {}) =>
  ({ id, name, serving, kcal, protein, carbs, fat, sugar, sodium, fiber: 0, veg: true, vegan: true, drink: true, allergens: [], ...extra });

export const DRINKS = [
  d('water', 'Water', COLD, 0, 0, 0, 0, 0, 0),
  d('skim-milk', 'Skim milk', COLD, 125, 12.4, 18.3, 0.3, 18.6, 155, { vegan: false, satFat: 0.2, allergens: ['Milk'] }),
  d('1-milk', '1% milk', COLD, 154, 12.4, 18.4, 3.6, 19, 160, { vegan: false, satFat: 2.3, allergens: ['Milk'] }),
  d('2-milk', '2% milk', COLD, 183, 12.1, 18, 7.2, 18.9, 150, { vegan: false, satFat: 4.6, allergens: ['Milk'] }),
  d('whole-milk', 'Whole milk', COLD, 224, 11.6, 17.6, 12, 18.5, 158, { vegan: false, satFat: 6.9, allergens: ['Milk'] }),
  d('choc-milk', 'Chocolate milk', COLD, 240, 12, 39, 3.6, 36, 225, { vegan: false, satFat: 2.3, fiber: 1.5, allergens: ['Milk'] }),
  d('soy-milk', 'Soy milk', COLD, 120, 9, 13.5, 4.5, 12, 135, { satFat: 0.6, fiber: 1.5, allergens: ['Soy'] }),
  d('oj', 'Orange juice', COLD, 165, 2.6, 39, 0.7, 31, 4, { fiber: 0.7 }),
  d('apple-juice', 'Apple juice', COLD, 170, 0.4, 42, 0.4, 36, 15, { fiber: 0.7 }),
  d('cran-juice', 'Cranberry juice cocktail', COLD, 205, 0, 51, 0, 46, 7),
  d('lemonade', 'Lemonade', COLD, 165, 0, 44, 0, 43, 25),
  d('fruit-punch', 'Fruit punch', COLD, 165, 0, 45, 0, 45, 90),
  d('sweet-tea', 'Sweet tea', COLD, 130, 0, 33, 0, 33, 15),
  d('iced-tea', 'Unsweetened iced tea', COLD, 3, 0, 1, 0, 0, 10),
  d('cola', 'Cola', COLD, 140, 0, 39, 0, 39, 45),
  d('diet-cola', 'Diet or zero-sugar cola', COLD, 0, 0, 0, 0, 0, 40),
  d('lemon-lime', 'Lemon-lime soda', COLD, 140, 0, 38, 0, 38, 65),
  d('root-beer', 'Root beer', COLD, 170, 0, 46, 0, 46, 65),
  d('orange-soda', 'Orange soda', COLD, 160, 0, 44, 0, 44, 55),
  d('coffee', 'Coffee, black', HOT, 2, 0.3, 0, 0, 0, 6),
  d('hot-tea', 'Hot tea', HOT, 2, 0, 0.5, 0, 0, 7),
  d('hot-chocolate', 'Hot chocolate', HOT, 150, 2, 28, 3.5, 23, 200, { vegan: false, satFat: 3, fiber: 1, allergens: ['Milk', 'Soy'] })
];

// Stations whose items are drinks the menu lists itself (VT's milk and juice): one serving becomes one cup.
const DRINK_STATION = /^beverages$/i;

// Add the drinks to a loaded menu: a "Drinks" station on every meal, and listed
// drinks rescaled to one cup.
export function addDrinks(menu) {
  for (const x of DRINKS) menu.items[`drink:${x.id}`] = { ...x };
  const ids = DRINKS.map((x) => `drink:${x.id}`);
  const rescaled = new Set();
  for (const court of Object.keys(menu.menus)) for (const meals of Object.values(menu.menus[court])) for (const m of meals) {
    for (const st of m.stations) {
      if (!DRINK_STATION.test(st.name)) continue;
      for (const id of st.items) {
        const it = menu.items[id];
        const oz = String(it?.serving || '').match(/^(?:1 )?(\d+(?:\.\d+)?) ?(?:fl )?oz$/i);
        if (!it || rescaled.has(id)) continue;
        rescaled.add(id);
        it.drink = true;
        if (!oz) continue;
        const f = CUP_OZ / Number(oz[1]);
        for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'satFat']) if (typeof it[k] === 'number') it[k] = Math.round(it[k] * f * 10) / 10;
        it.serving = COLD;
      }
    }
    if (!m.stations.some((st) => st.name === 'Drinks')) m.stations.push({ name: 'Drinks', items: ids });
  }
  return menu;
}
