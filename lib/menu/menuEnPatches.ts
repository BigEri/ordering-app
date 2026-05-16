import type { MenuItemData } from "../../components/MenuItem";
import type { Locale } from "../i18n/messages";
import type { MenuItemLocalePatch } from "./menuPatchTypes";
import { MENU_ITEM_KO } from "./menuKoPatches";

/** Anglické záplaty menu; struktura odpovídá českým položkám (merge podle id / indexu). */
export const MENU_ITEM_EN: Record<string, MenuItemLocalePatch> = {
  "polevka-rajcatova": {
    name: "Tomato soup",
    description: "Basil, Parmesan.",
    portionNote: "approx. 300 ml (250–340 ml, ± 10 %)",
    ingredients: [
      { name: "tomatoes" },
      { name: "basil" },
      { name: "Parmesan" },
    ],
    addons: {
      "polevka-rajcatova-parmazan": { label: "Extra Parmesan", portionNote: "15 g" },
      "polevka-rajcatova-pečivo": { label: "Crispy bread", portionNote: "40 g" },
      "polevka-rajcatova-chilli": { label: "Extra chilli", portionNote: "5 g" },
      "polevka-rajcatova-smetana": { label: "Extra cream / whipped cream", portionNote: "30 ml" },
    },
  },
  "polevka-kureci": {
    name: "Chicken broth",
    description: "Noodles, root vegetables.",
    portionNote: "approx. 320 ml (± 10 %)",
    ingredients: [
      { name: "chicken broth" },
      { name: "noodles" },
      { name: "carrot" },
      { name: "celery" },
      { name: "parsley" },
    ],
    addons: {
      "polevka-kureci-bezlepkove-nudle": { label: "Gluten-free noodles", portionNote: "instead of regular, 50 g" },
      "polevka-kureci-nudle": { label: "Extra noodles", portionNote: "50 g" },
      "polevka-kureci-maso": { label: "Extra meat from the broth", portionNote: "40 g" },
      "polevka-kureci-bylinky": { label: "Extra fresh herbs", portionNote: "5 g" },
      "polevka-kureci-vejce": { label: "Scrambled egg in the soup", portionNote: "1 pc" },
    },
  },
  "polevka-cesnecka": {
    name: "Garlic soup",
    description: "Cheese toast, croutons.",
    portionNote: "approx. 330 ml (± 10 %)",
    ingredients: [
      { name: "garlic" },
      { name: "potatoes" },
      { name: "croutons" },
      { name: "cheese" },
    ],
    addons: {
      "polevka-cesnecka-syr": { label: "Extra cheese for gratin", portionNote: "30 g" },
      "polevka-cesnecka-krutony": { label: "Extra croutons", portionNote: "25 g" },
      "polevka-cesnecka-cesnek": { label: "Extra garlic clove", portionNote: "1 pc" },
    },
  },
  "polevka-gulasova": {
    name: "Goulash soup",
    description: "Beef, paprika.",
    portionNote: "approx. 350 ml (± 10 %)",
    ingredients: [
      { name: "beef" },
      { name: "onion" },
      { name: "pepper" },
      { name: "garlic" },
    ],
    addons: {
      "polevka-gulasova-chleb-zdarma": { label: "Bread", portionNote: "55 g" },
      "polevka-gulasova-maso": { label: "Extra beef pieces", portionNote: "60 g" },
      "polevka-gulasova-chleb": { label: "Extra crispy bread", portionNote: "50 g" },
      "polevka-gulasova-kysela": { label: "Spoon of pickles", portionNote: "40 g" },
      "polevka-gulasova-chilli": { label: "Hot pepper / chilli", portionNote: "15 g" },
    },
  },
  "polevka-dynova": {
    name: "Pumpkin cream soup",
    description: "Seeds, cream.",
    portionNote: "approx. 300 ml (± 10 %)",
    ingredients: [
      { name: "pumpkin" },
      { name: "cream" },
      { name: "pumpkin seeds" },
    ],
    addons: {
      "polevka-dynova-seminka": { label: "Extra roasted pumpkin seeds", portionNote: "15 g" },
      "polevka-dynova-smetana": { label: "Extra cream", portionNote: "30 ml" },
      "polevka-dynova-pečivo": { label: "Grilled bread", portionNote: "45 g" },
      "polevka-dynova-koren": { label: "Warm spice (cinnamon, nutmeg)", portionNote: "a pinch" },
    },
  },
  "predkrm-bruschetta": {
    name: "Bruschetta",
    description: "Tomatoes, garlic, olive oil.",
    portionNote: "2 pcs · approx. 160 g (± 10 %)",
    ingredients: [
      { name: "baguette" },
      { name: "tomatoes" },
      { name: "garlic" },
      { name: "olive oil" },
      { name: "basil" },
    ],
    addons: {
      "predkrm-bruschetta-mozz": { label: "Extra mozzarella", portionNote: "50 g" },
      "predkrm-bruschetta-olivy": { label: "Extra olives", portionNote: "30 g" },
      "predkrm-bruschetta-kusy": { label: "Extra bruschetta piece", portionNote: "1 pc" },
    },
  },
  "predkrm-tatarak": {
    name: "Steak tartare",
    description: "Toasts, garlic. Mixed to your preference.",
    portionNote: "approx. 190 g meat mix + toasts (± 10 %)",
    ingredients: [
      { name: "beef" },
      { name: "egg yolk" },
      { name: "capers" },
      { name: "mustard" },
      { name: "toasts" },
      { name: "garlic" },
    ],
    addons: {
      "predkrm-tatarak-topinky": { label: "Extra toasts", portionNote: "3 pcs" },
      "predkrm-tatarak-okurky": { label: "Pickles", portionNote: "40 g" },
      "predkrm-tatarak-zloutek": { label: "Extra yolk", portionNote: "1 pc" },
      "predkrm-tatarak-feferonka": { label: "Hot pepper on the side", portionNote: "1 pc" },
    },
  },
  "predkrm-syr": {
    name: "Cheese board",
    description: "Selection of cheeses, grapes.",
    portionNote: "approx. 180 g cheese + sides (± 10 %)",
    ingredients: [
      { name: "cheese mix" },
      { name: "grapes" },
      { name: "nuts" },
    ],
    addons: {
      "predkrm-syr-hrozny": { label: "Extra grapes", portionNote: "80 g" },
      "predkrm-syr-med": { label: "Honey for the board", portionNote: "25 g" },
      "predkrm-syr-orechy": { label: "Extra nuts", portionNote: "25 g" },
      "predkrm-syr-chutney": { label: "Onion chutney", portionNote: "40 g" },
    },
  },
  "predkrm-olivy": {
    name: "Marinated olives",
    description: "Herbs, lemon.",
    portionNote: "approx. 120 g (± 10 %)",
    ingredients: [
      { name: "olives" },
      { name: "herbs" },
      { name: "lemon" },
    ],
    addons: {
      "predkrm-olivy-feta": { label: "Feta cubes", portionNote: "40 g" },
      "predkrm-olivy-chilli": { label: "Chilli peppers", portionNote: "15 g" },
      "predkrm-olivy-pečivo": { label: "Warm pita", portionNote: "1 pc" },
      "predkrm-olivy-citron": { label: "Extra lemon juice", portionNote: "10 ml" },
    },
  },
  "predkrm-krevety": {
    name: "Garlic prawns",
    description: "Chilli, baguette.",
    portionNote: "approx. 200 g prawns + side (± 10 %)",
    ingredients: [
      { name: "prawns" },
      { name: "garlic" },
      { name: "chilli" },
      { name: "baguette" },
    ],
    addons: {
      "predkrm-krevety-porc": { label: "Double portion of prawns", portionNote: "+120 g" },
      "predkrm-krevety-bageta": { label: "Extra baguette", portionNote: "1 pc" },
      "predkrm-krevety-citron": { label: "Extra lemon and parsley", portionNote: "1/4 pc" },
      "predkrm-krevety-omacka": { label: "Aioli dip", portionNote: "40 ml" },
    },
  },
  "hlavni-svickova": {
    name: "Beef in cream sauce (svíčková)",
    description: "Bread dumplings, cranberries.",
    portionNote: "approx. 480 g total incl. side (± 10 %)",
    ingredients: [
      { name: "beef" },
      { name: "cream sauce" },
      { name: "dumplings" },
      { name: "cranberries" },
    ],
    addons: {
      "hlavni-svickova-extra-hovezi": { label: "Extra beef", portionNote: "80 g" },
      "hlavni-svickova-knedlik": { label: "Extra dumpling", portionNote: "1 pc (~90 g)" },
      "hlavni-svickova-omacka": { label: "Extra sauce", portionNote: "80 ml" },
      "hlavni-svickova-brusinky": { label: "Extra cranberries / crisps", portionNote: "40 g" },
      "hlavni-svickova-kysela": { label: "Pickled gherkin", portionNote: "1 pc" },
    },
  },
  "hlavni-gulas": {
    name: "Beef goulash",
    description: "Onion, pepper, bread.",
    portionNote: "approx. 450 g (± 10 %)",
    ingredients: [
      { name: "beef" },
      { name: "onion" },
      { name: "pepper" },
      { name: "bread" },
    ],
    addons: {
      "hlavni-gulas-maso": { label: "Extra meat", portionNote: "60 g" },
      "hlavni-gulas-kyselo": { label: "Sauerkraut / cabbage on the side", portionNote: "120 g" },
      "hlavni-gulas-chleb": { label: "Extra bread", portionNote: "60 g" },
      "hlavni-gulas-cibule": { label: "Fried onion on top", portionNote: "40 g" },
    },
  },
  "hlavni-salat": {
    name: "Caesar salad",
    description: "Chicken, Parmesan, dressing.",
    portionNote: "approx. 320 g (± 10 %)",
    ingredients: [
      { name: "romaine lettuce" },
      { name: "chicken" },
      { name: "Parmesan" },
      { name: "croutons" },
      { name: "dressing" },
    ],
    addons: {
      "hlavni-salat-kure": { label: "Extra grilled chicken", portionNote: "80 g" },
      "hlavni-salat-ančovičky": { label: "Anchovies", portionNote: "15 g" },
      "hlavni-salat-parmazan": { label: "Extra Parmesan shavings", portionNote: "15 g" },
      "hlavni-salat-krutony": { label: "Extra croutons", portionNote: "30 g" },
    },
  },
  "hlavni-rizek": {
    name: "Chicken schnitzel",
    description: "Side of your choice, lemon.",
    portionNote: "approx. 420 g incl. side (± 10 %)",
    ingredients: [
      { name: "chicken" },
      { name: "breadcrumbs" },
      { name: "lemon" },
    ],
    sideChoice: {
      sectionLabel: "Sides",
      options: {
        "rizek-side-brambory": { label: "Potatoes" },
        "rizek-side-kase": { label: "Mashed potatoes" },
        "rizek-side-hranolky": { label: "Fries" },
        "rizek-side-bataty": { label: "Sweet potato fries" },
      },
    },
    addons: {
      "hlavni-rizek-tatarka": { label: "Tartar sauce", portionNote: "40 ml" },
      "hlavni-rizek-kedlubny": { label: "Kohlrabi salad", portionNote: "100 g" },
      "hlavni-rizek-citron": { label: "Extra lemon wedges", portionNote: "1/2 pc" },
    },
  },
  "hlavni-supreme": {
    name: "Chicken supreme",
    description:
      "Grilled chicken breast, cream sauce, Parma ham, Parmesan and grilled vegetables with mushrooms. One side of your choice.",
    portionNote: "approx. 430 g incl. side (± 10 %)",
    ingredients: [
      { name: "chicken breast" },
      { name: "cream sauce" },
      { name: "Parma ham" },
      { name: "Parmesan" },
      { name: "grilled vegetables" },
      { name: "mushrooms" },
    ],
    sideChoice: {
      sectionLabel: "Sides",
      options: {
        "supreme-side-brambory": { label: "Potatoes" },
        "supreme-side-kase": { label: "Mashed potatoes" },
        "supreme-side-hranolky": { label: "Fries" },
        "supreme-side-bataty": { label: "Sweet potato fries" },
      },
    },
    addons: {
      "hlavni-supreme-prso": { label: "Extra chicken breast", portionNote: "100 g" },
      "hlavni-supreme-omacka": { label: "Extra sauce", portionNote: "60 ml" },
      "hlavni-supreme-sunka": { label: "Extra ham", portionNote: "25 g" },
      "hlavni-supreme-syr": { label: "Extra Parmesan shavings", portionNote: "12 g" },
      "hlavni-supreme-zampiony": { label: "Extra mushrooms", portionNote: "40 g" },
      "hlavni-supreme-zelenina": { label: "Extra grilled vegetables", portionNote: "100 g" },
      "hlavni-supreme-tatarka": { label: "Tartar sauce", portionNote: "40 ml" },
    },
  },
  "hlavni-burger": {
    name: "Beef burger",
    description:
      "Bun, cheese, veg, dressing. No side — add fries, sweet potato fries or coleslaw under Options.",
    portionNote: "approx. 320 g burger (± 10 %)",
    ingredients: [
      { name: "beef" },
      { name: "bun" },
      { name: "cheese" },
      { name: "vegetables" },
    ],
    addonsSectionLabel: "Options",
    addons: {
      "burger-side-hranolky": { label: "Fries", portionNote: "150 g" },
      "burger-side-bataty": { label: "Sweet potato fries", portionNote: "150 g" },
      "burger-side-coleslaw": { label: "Coleslaw", portionNote: "120 g" },
      "burger-extra-cheese": { label: "Extra cheese slice", portionNote: "25 g" },
      "burger-extra-meat": { label: "Extra beef patty", portionNote: "90 g" },
      "burger-extra-onion": { label: "Extra fresh onion", portionNote: "20 g" },
      "burger-extra-bacon": { label: "Crispy bacon", portionNote: "30 g" },
      "burger-extra-jalapeno": { label: "Jalapeños", portionNote: "25 g" },
      "burger-extra-bbq": { label: "Extra BBQ sauce", portionNote: "30 ml" },
    },
  },
  "hlavni-testoviny": {
    name: "Pasta carbonara",
    description: "Pancetta, Parmesan.",
    portionNote: "approx. 400 g (± 10 %)",
    ingredients: [
      { name: "pasta" },
      { name: "pancetta" },
      { name: "egg" },
      { name: "Parmesan" },
      { name: "pepper" },
    ],
    addons: {
      "hlavni-testoviny-parmazan": { label: "Extra Parmesan", portionNote: "15 g" },
      "hlavni-testoviny-pancetta": { label: "Extra pancetta", portionNote: "35 g" },
      "hlavni-testoviny-chilli": { label: "Extra chilli", portionNote: "5 g" },
      "hlavni-testoviny-truffle": { label: "Drizzle of truffle oil", portionNote: "5 ml" },
    },
  },
  "hlavni-losos": {
    name: "Grilled salmon",
    description:
      "Grilled vegetables. No side — potatoes, mash, fries or sweet potato fries can be added under Options.",
    portionNote: "approx. 280 g salmon and vegetables (± 10 %)",
    ingredients: [
      { name: "salmon" },
      { name: "vegetables" },
    ],
    addonsSectionLabel: "Options",
    addons: {
      "hlavni-losos-side-brambory": { label: "Potatoes", portionNote: "150 g" },
      "hlavni-losos-side-stouchane": { label: "Crushed potatoes", portionNote: "200 g" },
      "hlavni-losos-side-kase": { label: "Mashed potatoes", portionNote: "200 g" },
      "hlavni-losos-side-hranolky": { label: "Fries", portionNote: "150 g" },
      "hlavni-losos-side-bataty": { label: "Sweet potato fries", portionNote: "150 g" },
      "hlavni-losos-koprova": { label: "Dill dip / sauce", portionNote: "50 ml" },
      "hlavni-losos-zelenina": { label: "Extra grilled vegetables", portionNote: "120 g" },
      "hlavni-losos-citron": { label: "Lemon and capers", portionNote: "20 g" },
    },
  },
  "hlavni-vege": {
    name: "Veggie bowl",
    description: "Quinoa, hummus, vegetables.",
    portionNote: "approx. 360 g (± 10 %)",
    ingredients: [
      { name: "quinoa" },
      { name: "hummus" },
      { name: "vegetables" },
      { name: "seeds" },
    ],
    addons: {
      "hlavni-vege-hummus": { label: "Extra hummus", portionNote: "60 g" },
      "hlavni-vege-avokado": { label: "Avocado slices", portionNote: "1/2 pc" },
      "hlavni-vege-tahini": { label: "Tahini dressing", portionNote: "40 ml" },
      "hlavni-vege-seminka": { label: "Toasted seed mix", portionNote: "15 g" },
    },
  },
  "dessert-cheesecake": {
    name: "Cheesecake",
    description: "Berries.",
    portionNote: "approx. 140 g (± 10 %)",
    ingredients: [
      { name: "cream cheese" },
      { name: "biscuits" },
      { name: "berries" },
    ],
    addons: {
      "dessert-cheesecake-omacka": { label: "Berry sauce", portionNote: "50 ml" },
      "dessert-cheesecake-slehacka": { label: "Whipped cream", portionNote: "40 ml" },
      "dessert-cheesecake-orechy": { label: "Caramelised nuts", portionNote: "25 g" },
      "dessert-cheesecake-kousek": { label: "Larger portion (1 extra slice)", portionNote: "+120 g" },
    },
  },
  "dessert-tiramisu": {
    name: "Tiramisu",
    description: "Coffee, mascarpone.",
    portionNote: "approx. 130 g (± 10 %)",
    ingredients: [
      { name: "mascarpone" },
      { name: "coffee" },
      { name: "ladyfingers" },
      { name: "cocoa" },
    ],
    addons: {
      "dessert-tiramisu-kakao": { label: "Extra cocoa", portionNote: "5 g" },
      "dessert-tiramisu-espresso": { label: "Espresso to pour over", portionNote: "30 ml" },
      "dessert-tiramisu-amaretto": { label: "Amaretto syrup (non-alcoholic)", portionNote: "20 ml" },
      "dessert-tiramisu-slehacka": { label: "Whipped cream on the side", portionNote: "40 ml" },
    },
  },
  "dessert-pala": {
    name: "Crêpes",
    description: "Build your crêpes",
    portionNote: "2 crêpes as base (± 10 %)",
    ingredients: [
      { name: "crêpes" },
      { name: "Nutella" },
      { name: "fruit" },
    ],
    multiPickGroups: [
      {
        id: "pala-grp-sladke",
        sectionLabel: "Sweet toppings",
        options: {
          "pala-sladke-none": { label: "no sweet toppings" },
          "pala-sladke-banan": { label: "banana" },
          "pala-sladke-boruvky": { label: "blueberries" },
          "pala-sladke-jahody": { label: "strawberries" },
          "pala-sladke-lesni": { label: "forest fruit" },
          "pala-sladke-ciniminis": { label: "crushed Cini Minis" },
          "pala-sladke-kinder-bueno": { label: "Kinder Bueno" },
          "pala-sladke-kinder-coko": { label: "Kinder chocolate" },
          "pala-sladke-kinder-maxi": { label: "Kinder Maxi King" },
          "pala-sladke-kokos": { label: "coconut" },
          "pala-sladke-lotus": { label: "Lotus crumble" },
          "pala-sladke-oreo": { label: "Oreo" },
          "pala-sladke-orisky": { label: "nuts" },
          "pala-sladke-maliny": { label: "raspberries" },
        },
      },
      {
        id: "pala-grp-slane",
        sectionLabel: "Savoury toppings",
        options: {
          "pala-slane-none": { label: "no savoury toppings" },
          "pala-slane-spenat": { label: "fresh spinach" },
          "pala-slane-cheddar": { label: "cheddar sauce" },
          "pala-slane-sunka": { label: "ham" },
          "pala-slane-kure": { label: "chicken" },
          "pala-slane-syr": { label: "grated cheese" },
          "pala-slane-kukurice": { label: "sweetcorn" },
          "pala-slane-slanina": { label: "bacon" },
          "pala-slane-zampiony": { label: "mushrooms" },
          "pala-slane-salam": { label: "salami" },
        },
      },
      {
        id: "pala-grp-sladka-pol",
        sectionLabel: "Sweet drizzle",
        options: {
          "pala-spol-none": { label: "no drizzle" },
          "pala-spol-coko": { label: "chocolate sauce" },
          "pala-spol-jahoda": { label: "strawberry sauce" },
          "pala-spol-javor": { label: "maple syrup" },
          "pala-spol-karamel": { label: "caramel topping" },
          "pala-spol-vanilka": { label: "vanilla sauce" },
          "pala-spol-bila-coko": { label: "white chocolate" },
          "pala-spol-malina": { label: "raspberry sauce" },
          "pala-spol-kondenz": { label: "condensed milk" },
        },
      },
    ],
    savoryGlazeChoice: {
      sectionLabel: "Savoury sauce",
      options: {
        "pala-slpol-bez": { label: "no sauce" },
        "pala-slpol-cheddar": { label: "cheddar sauce" },
        "pala-slpol-smetana": { label: "sour cream" },
        "pala-slpol-kecup": { label: "ketchup" },
        "pala-slpol-majo": { label: "mayonnaise" },
      },
    },
  },
  "dessert-zmrz": {
    name: "Ice cream sundae",
    description: "Chocolate, whipped cream.",
    portionNote: "approx. 200 g (± 10 %)",
    ingredients: [
      { name: "ice cream" },
      { name: "chocolate" },
      { name: "whipped cream" },
    ],
    addons: {
      "dessert-zmrz-kopecek": { label: "Extra scoop of ice cream", portionNote: "50 g" },
      "dessert-zmrz-poleva": { label: "Extra chocolate sauce", portionNote: "30 ml" },
      "dessert-zmrz-orechy": { label: "Nuts / crunchy topping", portionNote: "20 g" },
      "dessert-zmrz-ovoce": { label: "Fresh fruit", portionNote: "60 g" },
    },
  },
  "dessert-kolac": {
    name: "Apple pie",
    description: "Cinnamon, vanilla sauce.",
    portionNote: "approx. 150 g (± 10 %)",
    ingredients: [
      { name: "apples" },
      { name: "cinnamon" },
      { name: "pastry" },
      { name: "vanilla sauce" },
    ],
    addons: {
      "dessert-kolac-zmrzlina": { label: "Scoop of vanilla ice cream", portionNote: "50 g" },
      "dessert-kolac-omacka": { label: "Extra vanilla sauce", portionNote: "50 ml" },
      "dessert-kolac-slehacka": { label: "Whipped cream", portionNote: "40 ml" },
      "dessert-kolac-skorice": { label: "Cinnamon sugar on top", portionNote: "2 g" },
    },
  },
  "napoj-voda": {
    name: "Water",
    description: "Still / sparkling.",
    portionNote: "0.33 l (± 5 ml); large bottle per surcharge",
    ingredients: [{ name: "water" }],
    addons: {
      "napoj-voda-citron": { label: "Lemon / lime", portionNote: "2 slices" },
      "napoj-voda-velka": { label: "Large bottle (0.75 l)", portionNote: "750 ml" },
      "napoj-voda-perliva": { label: "Switch to sparkling", portionNote: "same volume" },
    },
  },
  "napoj-kola": {
    name: "Cola",
    description: "0.33 l.",
    portionNote: "0.33 l base (0.5 l with surcharge, ± 5 ml)",
    ingredients: [{ name: "cola" }],
    addons: {
      "cola-05": { label: "0.5 L", portionNote: "500 ml" },
      "napoj-kola-led": { label: "Ice", portionNote: "approx. 80 g" },
      "napoj-kola-citron": { label: "Lemon slice", portionNote: "1 pc" },
    },
  },
  "napoj-pivo": {
    name: "Beer",
    description: "0.3 l.",
    portionNote: "0.3 l (± 10 ml)",
    ingredients: [{ name: "beer" }],
    addons: {
      "napoj-pivo-velke": { label: "Large beer", portionNote: "0.5 l" },
    },
  },
  "napoj-kava": {
    name: "Espresso",
    description: "Single shot.",
    portionNote: "approx. 40 ml (single); double per surcharge",
    ingredients: [{ name: "coffee" }],
    addons: {
      "double-shot": { label: "Double shot", portionNote: "+40 ml" },
      "napoj-kava-americano": { label: "Americano", portionNote: "hot water approx. 120 ml" },
      "napoj-kava-mleko": { label: "Milk", portionNote: "60 ml" },
      "napoj-kava-sojove": { label: "Soy milk", portionNote: "60 ml" },
      "napoj-kava-cokolada": { label: "Espresso with chocolate (mocha)", portionNote: "25 ml" },
      "napoj-kava-led": { label: "Extra ice", portionNote: "approx. 60 g" },
    },
  },
  "napoj-caj": {
    name: "Tea",
    description: "Your choice.",
    portionNote: "approx. 0.25–0.3 l cup (± 10 %)",
    ingredients: [{ name: "tea" }],
    sideChoice: {
      sectionLabel: "Tea flavour",
      summaryLabel: "Flavour",
      options: {
        "napoj-caj-cerny": { label: "Black tea" },
        "napoj-caj-matovy": { label: "Mint tea" },
        "napoj-caj-ovocny": { label: "Fruit tea" },
        "napoj-caj-mango": { label: "Mango" },
        "napoj-caj-zeleny": { label: "Green tea" },
        "napoj-caj-bylinkovy": { label: "Herbal tea" },
        "napoj-caj-rooibos": { label: "Rooibos" },
      },
    },
    addonsSectionLabel: "Add-ins",
    addons: {
      milk: { label: "Milk", portionNote: "50 ml" },
      "napoj-caj-med": { label: "Honey", portionNote: "15 g" },
      "napoj-caj-citron": { label: "Lemon", portionNote: "1 slice" },
    },
  },
  "napoj-limo": {
    name: "Homemade lemonade",
    description: "0.4 l, flavour of your choice.",
    portionNote: "0.4 l (0.7 l with Large surcharge, ± 5 ml)",
    ingredients: [
      { name: "citrus" },
      { name: "mint" },
      { name: "soda" },
    ],
    sideChoice: {
      sectionLabel: "Lemonade flavour",
      summaryLabel: "Flavour",
      options: {
        "napoj-limo-jahody": { label: "Strawberry" },
        "napoj-limo-mango": { label: "Mango" },
        "napoj-limo-pomeranc": { label: "Orange" },
        "napoj-limo-citron": { label: "Lemon" },
      },
    },
    addonsSectionLabel: "Extra options",
    addons: {
      "napoj-limo-mata": { label: "Extra mint", portionNote: "5 g" },
      "napoj-limo-velka": { label: "Large", portionNote: "0.7 l" },
    },
  },
  "napoj-vino": {
    name: "Wine (by the glass)",
    description: "0.2 l.",
    portionNote: "0.2 l (0.3 l with surcharge, ± 5 ml)",
    ingredients: [{ name: "wine" }],
    addons: {
      "napoj-vino-deci": { label: "Extra 0.1 l (0.3 l total)", portionNote: "100 ml" },
      "napoj-vino-soda": { label: "Spritzer (soda)", portionNote: "80 ml" },
      "napoj-vino-led": { label: "Extra ice", portionNote: "approx. 60 g" },
    },
  },
};

const MENU_PATCHES: Record<Exclude<Locale, "cs">, Record<string, MenuItemLocalePatch>> = {
  en: MENU_ITEM_EN,
  ko: MENU_ITEM_KO,
};

export function localizeMenuItem(item: MenuItemData, locale: Locale): MenuItemData {
  if (locale === "cs") return item;
  const patch = MENU_PATCHES[locale][item.id];
  if (!patch) return item;

  const ingredients = item.ingredients?.map((line, i) => {
    const p = patch.ingredients?.[i];
    if (!p) return line;
    return {
      ...line,
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.portionNote !== undefined ? { portionNote: p.portionNote } : {}),
    };
  });

  const addons = item.addons?.map((a) => {
    const p = patch.addons?.[a.id];
    if (!p) return a;
    return {
      ...a,
      ...(p.label !== undefined ? { label: p.label } : {}),
      ...(p.portionNote !== undefined ? { portionNote: p.portionNote } : {}),
    };
  });

  let sideChoice = item.sideChoice;
  if (item.sideChoice && patch.sideChoice) {
    const po = patch.sideChoice;
    sideChoice = {
      ...item.sideChoice,
      ...(po.sectionLabel !== undefined ? { sectionLabel: po.sectionLabel } : {}),
      ...(po.summaryLabel !== undefined ? { summaryLabel: po.summaryLabel } : {}),
      options: item.sideChoice.options.map((o) => {
        const op = po.options?.[o.id];
        if (!op) return o;
        return {
          ...o,
          ...(op.label !== undefined ? { label: op.label } : {}),
          ...(op.portionNote !== undefined ? { portionNote: op.portionNote } : {}),
        };
      }),
    };
  }

  let multiPickGroups = item.multiPickGroups;
  if (item.multiPickGroups && patch.multiPickGroups?.length) {
    multiPickGroups = item.multiPickGroups.map((g) => {
      const gp = patch.multiPickGroups!.find((x) => x.id === g.id);
      if (!gp) return g;
      return {
        ...g,
        ...(gp.sectionLabel !== undefined ? { sectionLabel: gp.sectionLabel } : {}),
        options: g.options.map((o) => {
          const op = gp.options?.[o.id];
          if (!op) return o;
          return {
            ...o,
            ...(op.label !== undefined ? { label: op.label } : {}),
            ...(op.portionNote !== undefined ? { portionNote: op.portionNote } : {}),
          };
        }),
      };
    });
  }

  let savoryGlazeChoice = item.savoryGlazeChoice;
  if (item.savoryGlazeChoice && patch.savoryGlazeChoice) {
    const sg = patch.savoryGlazeChoice;
    savoryGlazeChoice = {
      ...item.savoryGlazeChoice,
      ...(sg.sectionLabel !== undefined ? { sectionLabel: sg.sectionLabel } : {}),
      options: item.savoryGlazeChoice.options.map((o) => {
        const op = sg.options?.[o.id];
        if (!op) return o;
        return {
          ...o,
          ...(op.label !== undefined ? { label: op.label } : {}),
          ...(op.portionNote !== undefined ? { portionNote: op.portionNote } : {}),
        };
      }),
    };
  }

  return {
    ...item,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.portionNote !== undefined ? { portionNote: patch.portionNote } : {}),
    ...(patch.addonsSectionLabel !== undefined ? { addonsSectionLabel: patch.addonsSectionLabel } : {}),
    ...(ingredients !== undefined ? { ingredients } : {}),
    ...(addons !== undefined ? { addons } : {}),
    ...(sideChoice !== undefined ? { sideChoice } : {}),
    ...(multiPickGroups !== undefined ? { multiPickGroups } : {}),
    ...(savoryGlazeChoice !== undefined ? { savoryGlazeChoice } : {}),
  };
}

export function localizeIngredientNamesForDisplay(
  item: MenuItemData,
  excludedCsNames: string[],
  locale: Locale,
): string[] {
  if (locale === "cs") return excludedCsNames;
  const loc = localizeMenuItem(item, locale);
  const base = item.ingredients ?? [];
  const labels = loc.ingredients ?? [];
  return excludedCsNames.map((cs) => {
    const idx = base.findIndex((l) => l.name === cs);
    if (idx >= 0 && labels[idx]) return labels[idx]!.name;
    return cs;
  });
}

/** Chybová hláška při neplatném počtu v multiPickGroups; `t` vrací řetězec s {{section}}, {{min}}, {{max}}. */
export function validateMultiPicksMessage(
  item: MenuItemData,
  picks: Record<string, string[]>,
  locale: Locale,
  t: (key: string) => string,
): string | null {
  const loc = localizeMenuItem(item, locale);
  for (const g of item.multiPickGroups ?? []) {
    const n = picks[g.id]?.length ?? 0;
    if (n < g.minPick || n > g.maxPick) {
      const label = loc.multiPickGroups?.find((x) => x.id === g.id)?.sectionLabel ?? g.sectionLabel;
      return t("menu.detail.multi.error")
        .replace("{{section}}", label)
        .replace("{{min}}", String(g.minPick))
        .replace("{{max}}", String(g.maxPick));
    }
  }
  return null;
}
