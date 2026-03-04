# Обяснение: Auto-Refresh vs Manual Data Loading

## 📖 Какво означава "Manual data loading — user-initiated (не са auto-refresh)"?

### 🔄 Auto-Refresh (Автоматично зареждане)
**Определение**: Данните се зареждат **автоматично** когато се променят в базата данни, без потребителят да направи нещо.

**Как работи**:
- Real-time subscriptions слушат за промени в базата данни
- Когато има промяна (INSERT, UPDATE, DELETE), данните се зареждат автоматично
- Потребителят **не трябва да направи нищо** - всичко е автоматично

**Примери от кода**:

#### 1. **Cart Items (Кошница)**
```typescript
// Real-time subscription слуша за промени в cart_items
const cartSubscription = supabase
  .channel('cart_changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'cart_items' },
    () => {
      loadTableSessions(); // ✅ АВТОМАТИЧНО зареждане
    }
  )
  .subscribe();
```
**Кога се зарежда**: Когато някой добави/премахне артикул от кошницата в базата данни
**Кой го зарежда**: Системата автоматично (real-time subscription)
**Потребителят трябва ли да направи нещо**: ❌ НЕ

---

#### 2. **Table Requests (Поръчки, заявки)**
```typescript
// Real-time subscription слуша за промени в table_requests
const requestsSubscription = supabase
  .channel('requests_changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'table_requests' },
    (payload) => {
      loadTableSessions(); // ✅ АВТОМАТИЧНО зареждане
    }
  )
  .subscribe();
```
**Кога се зарежда**: Когато някой направи поръчка, заявка за сметка, или аниматор
**Кой го зарежда**: Системата автоматично (real-time subscription)
**Потребителят трябва ли да направи нещо**: ❌ НЕ

---

### 👤 Manual Data Loading (Ръчно зареждане)
**Определение**: Данните се зареждат **само когато потребителят направи конкретно действие** (кликне бутон, отвори модал, смени таб, и т.н.).

**Как работи**:
- Няма real-time subscription
- Данните се зареждат само когато потребителят извика функцията
- Потребителят **трябва да направи нещо** за да се заредят данните

**Примери от кода**:

#### 1. **Revenue Report (Оборотен репорт)**
```typescript
// RevenueReport.tsx
const handleGenerateReport = async () => {
  setLoading(true);
  try {
    const revenueReport = await getRevenueReport(selectedDate); // ✅ РЪЧНО зареждане
    setReport(revenueReport);
  } catch (error) {
    // ...
  }
};

// Извиква се само когато потребителят кликне бутона "Генерирай"
<Button onClick={handleGenerateReport}>Генерирай</Button>
```
**Кога се зарежда**: Само когато потребителят кликне бутона "Генерирай"
**Кой го зарежда**: Потребителят (чрез кликване на бутон)
**Потребителят трябва ли да направи нещо**: ✅ ДА - трябва да кликне бутона

---

#### 2. **Daily Menu Items (Меню за деня)**
```typescript
// MenuEditor.tsx
const loadDailyMenu = useCallback(async () => {
  setDailyMenuLoading(true);
  try {
    const items = await getDailyMenuItems(selectedDate); // ✅ РЪЧНО зареждане
    setDailyItems(items);
  } catch (error) {
    // ...
  }
}, [selectedDate, getDailyMenuItems, toast]);

// Извиква се само когато потребителят отвори таба "Меню за деня"
useEffect(() => {
  if (activeTab === 'daily') {
    loadDailyMenu(); // Извиква се само когато activeTab стане 'daily'
  }
}, [activeTab, loadDailyMenu]);
```
**Кога се зарежда**: Само когато потребителят отвори таба "Меню за деня"
**Кой го зарежда**: Потребителят (чрез отваряне на таб)
**Потребителят трябва ли да направи нещо**: ✅ ДА - трябва да отвори таба

---

#### 3. **Customer Rating (Оценка от клиент)**
```typescript
// RestaurantContext.tsx
const submitRating = useCallback(async (tableId: string, rating: number, feedback?: string) => {
  try {
    const { error } = await supabase
      .from('customer_ratings')
      .insert({ /* ... */ }); // ✅ РЪЧНО зареждане/запис
    // ...
  }
}, []);
```
**Кога се зарежда**: Само когато потребителят изпрати оценка
**Кой го зарежда**: Потребителят (чрез изпращане на форма)
**Потребителят трябва ли да направи нещо**: ✅ ДА - трябва да изпрати оценката

---

## 📊 Сравнение

| Характеристика | Auto-Refresh | Manual Loading |
|----------------|--------------|----------------|
| **Кога се зарежда** | Автоматично при промяна в БД | Само при потребителско действие |
| **Кой го зарежда** | Системата (real-time subscription) | Потребителят (клик, отваряне, и т.н.) |
| **Потребителят трябва ли да направи нещо** | ❌ НЕ | ✅ ДА |
| **Примери** | Cart items, Table requests, Restaurant tables | Revenue report, Daily menu (при отваряне), Rating submission |
| **Използва ли real-time subscription** | ✅ ДА | ❌ НЕ |
| **Трябва ли да бъде моментално** | ✅ ДА (за критични данни) | ⚠️ Може да има забавяне (не е критично) |

---

## 🎯 Защо това е важно?

### Auto-Refresh операции:
- ✅ **Трябва да бъдат моментални** (0ms delay)
- ✅ Защото потребителят очаква да вижда промените веднага
- ✅ Например: Когато клиент направи поръчка, админът трябва да я види веднага

### Manual Loading операции:
- ⚠️ **Не трябва да бъдат моментални** (може да има забавяне)
- ⚠️ Защото потребителят знае че трябва да изчака (кликнал е бутон)
- ⚠️ Например: Когато админът генерира репорт, знае че трябва да изчака

---

## ✅ Заключение

**"Manual data loading — user-initiated (не са auto-refresh)"** означава:

- Тези операции **НЕ са** автоматично зареждане
- Те се зареждат **само когато потребителят направи конкретно действие**
- Те **НЕ трябва** да бъдат моментални (не са критични за real-time)
- Те **НЕ използват** real-time subscriptions
- Те са **правилно имплементирани** като user-initiated операции

**Примери**:
- ✅ `getRevenueReport()` - извиква се само когато потребителят кликне "Генерирай"
- ✅ `getDailyMenuItems()` - извиква се само когато потребителят отвори таб/страница
- ✅ `submitRating()` - извиква се само когато потребителят изпрати оценка

**Тези операции НЕ трябва да бъдат моментални**, защото:
1. Потребителят знае че трябва да изчака
2. Не са критични за real-time синхронизация
3. Не се използват често (не са в основния поток на работа)
