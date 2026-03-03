# Supabase Migration Guide

## Стъпка 1: Създаване на Database Schema в новия проект

**Важно:** Първо трябва да създадеш всички таблици в новия Supabase проект преди да мигрираш данните.

### Опция A: Чрез Supabase Dashboard (Препоръчително)

1. Отиди на новия Supabase проект: https://zqnyugoudabtqieuqhrp.supabase.co
2. Отиди на **SQL Editor** в лявото меню
3. Кликни **New Query**
4. Отвори файла `scripts/setup-new-supabase.sql` и копирай целия SQL код
5. Постави го в SQL Editor
6. Кликни **Run** (или натисни Ctrl+Enter)

### Опция B: Чрез Supabase CLI

```bash
# Инсталирай Supabase CLI (ако нямаш)
npm install -g supabase

# Login
supabase login

# Link към новия проект
supabase link --project-ref zqnyugoudabtqieuqhrp

# Изпълни SQL файла
supabase db execute -f scripts/setup-new-supabase.sql
```

## Стъпка 2: Миграция на данните

След като схемата е създадена, стартирай миграцията на данните:

```bash
npm run migrate
```

Това ще:
- Експортира всички данни от стария проект
- Импортира ги в новия проект
- Покаже обобщение на миграцията

## Проверка

След миграцията, провери в новия Supabase проект:
1. Отиди на **Table Editor**
2. Провери дали всички таблици имат данни
3. Тествай приложението дали работи правилно

## Таблици които ще се мигрират:

- ✅ `menu_items` - Меню артикули
- ✅ `restaurant_tables` - Маси
- ✅ `cart_items` - Кошници
- ✅ `table_requests` - Заявки/Поръчки
- ✅ `daily_menu_assignments` - Дневно меню
- ✅ `customer_ratings` - Рейтинги
- ✅ `completed_orders` - Завършени поръчки
- ✅ `table_history_archive` - Архивна история

## Troubleshooting

### Грешка: "Could not find the table"
- Увери се че си изпълнил `setup-new-supabase.sql` в новия проект
- Провери дали всички таблици са създадени в Table Editor

### Грешка: "Permission denied"
- Провери дали RLS policies са създадени правилно
- Увери се че anon key има достъп до таблиците

### Грешка при импорт
- Провери дали foreign keys са правилно настроени
- Увери се че референциите (menu_item_id, table_id) съществуват
