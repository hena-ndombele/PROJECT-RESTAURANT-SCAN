import { useEffect, useMemo, useRef, useState } from 'react';
import { cancelOrder, createOrder, getOrder, requestBill, trackOrder, updateOrderItems } from '../features/cart/orderApi';
import { buildReceiptPdf } from '../features/cart/receiptPdf';
import { useCart } from '../features/cart/useCart';
import { submitFeedback } from '../features/feedback/feedbackApi';
import { getPublicMenu } from '../features/menu/menuApi';
import { getEcho } from '../shared/api/realtime';
import { assetUrl } from '../shared/api/httpClient';
import { formatMoney } from '../shared/lib/money';

const fallbackMenuImages = [
  '/img/menu/1.jpg',
  '/img/menu/2.jpg',
  '/img/menu/3.jpg',
  '/img/menu/4.jpg',
  '/img/menu/5.jpg',
  '/img/menu/6.jpg',
];

const fallbackCategoryImages = [
  '/img/category/1.jpg',
  '/img/category/2.jpg',
  '/img/category/3.jpg',
  '/img/category/4.jpg',
  '/img/category/5.jpg',
  '/img/category/6.jpg',
];

const ACTIVE_ORDER_STORAGE_KEY = 'e-resto-active-order-id';
const ACTIVE_ORDER_STATUS_STORAGE_KEY = 'e-resto-active-order-status';
const ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY = 'e-resto-active-order-tracking-code';
const ACTIVE_ORDER_BY_TABLE_PREFIX = 'e-resto-active-order-table-';
const FEEDBACK_STORAGE_PREFIX = 'e-resto-feedback-';
let notificationAudioContext;
let notificationAudioUnlocked = false;

const staticPlats = [
  {
    id: 'demo-1',
    name: 'Classic Smash Burger',
    description: 'Double smashed patty, cheddar, caramelized onions, pickles and special sauce',
    price: 14.99,
    currency: 'USD',
    preparation_time: 12,
    ingredients: ['Spicy', 'Bestseller', 'Beef'],
    image_url: '/img/menu/1.jpg',
    category: { id: 'burgers', name: 'Burgers' },
  },
  {
    id: 'demo-2',
    name: 'Truffle Mushroom Pizza',
    description: 'Mozzarella, mushrooms, truffle oil and basil on a crispy artisan crust',
    price: 18.99,
    currency: 'USD',
    preparation_time: 18,
    ingredients: ['Vegetarian', 'Chef Pick', 'Italian'],
    image_url: '/img/menu/2.jpg',
    category: { id: 'pizza', name: 'Pizza' },
  },
  {
    id: 'demo-3',
    name: 'Nashville Hot Chicken',
    description: 'Crispy fried chicken glazed with Nashville spice and served with pickles',
    price: 16.5,
    currency: 'USD',
    preparation_time: 16,
    ingredients: ['Hot', 'Chicken', 'Crunchy'],
    image_url: '/img/menu/3.jpg',
    category: { id: 'chicken', name: 'Fried Chicken' },
  },
];

function useTableId() {
  return useMemo(() => new URLSearchParams(window.location.search).get('table_id'), []);
}

function useOrderIdFromUrl() {
  return useMemo(() => new URLSearchParams(window.location.search).get('order_id'), []);
}

function useRestaurantSlug() {
  return useMemo(() => new URLSearchParams(window.location.search).get('restaurant_slug'), []);
}

export function App() {
  const tableId = useTableId();
  const orderIdFromUrl = useOrderIdFromUrl();
  const restaurantSlug = useRestaurantSlug();
  const cart = useCart();
  const [menu, setMenu] = useState({ categories: [], plats: [] });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeView, setActiveView] = useState('menu');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPlat, setSelectedPlat] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [backToTop, setBackToTop] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [brand, setBrand] = useState({
    name: 'E-RESTO',
    logo_url: '/img/logo/e-resto-logo.png',
    slogan: 'Fast Food & Restaurant',
    description: 'Fast Food & Restaurant',
    can_feedback: false,
    can_reservations: false,
    can_mobile_money: false,
    can_chatbot: false,
    payment_methods: ['cash'],
    theme: {
      primary: '#F9A11B',
      secondary: '#111111',
      background: '#fff7ef',
    },
  });
  const [cancelledOrderModal, setCancelledOrderModal] = useState(null);

  useEffect(() => {
    const prepare = () => prepareCustomerNotifications();

    window.addEventListener('click', prepare, { once: true });
    window.addEventListener('touchstart', prepare, { once: true });
    window.addEventListener('keydown', prepare, { once: true });

    return () => {
      window.removeEventListener('click', prepare);
      window.removeEventListener('touchstart', prepare);
      window.removeEventListener('keydown', prepare);
    };
  }, []);

  useEffect(() => {
    getPublicMenu(tableId ? { table_id: tableId } : (restaurantSlug ? { restaurant_slug: restaurantSlug } : {}))
      .then((response) => {
        setMenu(response);
        if (response.restaurant) {
          const nextBrand = buildClientBrand(response.restaurant);
          setBrand(nextBrand);
          applyClientTheme(nextBrand);
        }
      })
      .catch((error) => {
        setMenuError(tableId
          ? (error.message || "Cette table n'est pas disponible pour commander.")
          : "Le menu backend n'est pas disponible pour le moment.");
        setMenu(tableId ? { categories: [], plats: [] } : {
          categories: [
            { id: 'burgers', name: 'Burgers', plats_count: 1 },
            { id: 'pizza', name: 'Pizza', plats_count: 1 },
            { id: 'chicken', name: 'Fried Chicken', plats_count: 1 },
          ],
          plats: staticPlats,
        });
      })
      .finally(() => setLoadingMenu(false));
  }, [restaurantSlug, tableId]);

  useEffect(() => {
    const tableOrderId = tableId ? localStorage.getItem(`${ACTIVE_ORDER_BY_TABLE_PREFIX}${tableId}`) : null;
    const storedOrderId = orderIdFromUrl || tableOrderId || localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
    const storedTrackingCode = new URLSearchParams(window.location.search).get('tracking_code')
      || localStorage.getItem(ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY);
    if (!storedOrderId && !storedTrackingCode) {
      if (tableId) {
        setRecoveryNotice('Si vous avez deja commande depuis un autre telephone, entrez votre code de suivi ou votre numero pour retrouver votre commande. Sinon, commandez normalement.');
      }
      return;
    }

    const storedStatus = localStorage.getItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);

    const restoreRequest = storedTrackingCode
      ? trackOrder({
        order_id: storedOrderId || undefined,
        code: storedTrackingCode || undefined,
        table_id: tableId || undefined,
      })
      : getOrder(storedOrderId);

    restoreRequest
      .then((order) => {
        setActiveOrder(order);
        if (order.status === 'cancelled') {
          const notification = {
            type: 'error',
            title: statusLabels[order.status] ?? 'Commande annulee',
            message: getStatusNotificationMessage(order.status),
          };
          setSnackbar(notification);
          setCancelledOrderModal(order);
          playOrderNotificationSound('error');
          notifyBrowser(notification.title, notification.message);
          clearRememberedOrder(tableId);
          return;
        }

        if (order.status === 'delivered') {
          clearRememberedOrder(tableId);
          return;
        }

        rememberActiveOrder(order, tableId, Boolean(orderIdFromUrl));

        if (storedStatus && storedStatus !== order.status) {
          const notification = {
            type: order.status === 'cancelled' ? 'error' : 'success',
            title: statusLabels[order.status] ?? 'Statut mis a jour',
            message: getStatusNotificationMessage(order.status),
          };
          setSnackbar(notification);
          playOrderNotificationSound(notification.type);
          notifyBrowser(notification.title, notification.message);
        } else {
          setSnackbar({
            type: 'info',
            title: 'Suivi restaure',
            message: `Votre commande est ${statusLabels[order.status]?.toLowerCase() ?? order.status}.`,
          });
          setTimeout(() => {
            document.getElementById('order-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 180);
        }
      })
      .catch((error) => {
        if (tableId && !storedOrderId && !storedTrackingCode) {
          setRecoveryNotice(error.message || 'Entrez votre code de suivi pour retrouver votre commande.');
          setSnackbar({
            type: 'info',
            title: 'Commande a identifier',
            message: error.message || 'Entrez votre code de suivi pour retrouver votre commande.',
          });
        }
        if (storedOrderId || storedTrackingCode) {
          clearRememberedOrder(tableId);
        }
      });
  }, [orderIdFromUrl, tableId]);

  useEffect(() => {
    const onScroll = () => {
      document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 60);
      setBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!brand.can_feedback || !activeOrder?.id || !canShowFeedbackForOrder(activeOrder)) return;
    if (localStorage.getItem(`${FEEDBACK_STORAGE_PREFIX}${activeOrder.id}`)) return;

    const feedbackTimer = window.setTimeout(() => setFeedbackOrder(activeOrder), 600);
    return () => window.clearTimeout(feedbackTimer);
  }, [brand.can_feedback, activeOrder?.id, activeOrder?.status, activeOrder?.order_type]);

  const filteredPlats = menu.plats.filter((plat) => {
    const matchesCategory = selectedCategory === 'all' || plat.category?.id === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${plat.name} ${plat.description}`.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const openDetails = (plat) => setSelectedPlat(plat);

  return (
    <>
      <TopBar brand={brand} />
      <Navbar
        brand={brand}
        onSearch={() => setSearchOpen(true)}
        cartCount={cart.totals.totalQuantity}
        activeView={activeView}
        activeOrder={activeOrder}
        onView={setActiveView}
      />
      <MobileBottomNav
        cartCount={cart.totals.totalQuantity}
        activeView={activeView}
        activeOrder={activeOrder}
        onView={setActiveView}
      />
      <SearchOverlay
        open={searchOpen}
        value={search}
        categories={menu.categories}
        onChange={setSearch}
        onClose={() => setSearchOpen(false)}
        onPickCategory={(id) => {
          setSelectedCategory(id);
          setActiveView('menu');
          setSearchOpen(false);
          document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <main className="client-app-shell">
        {activeView === 'menu' && (
          <div className="menu-view">
            <MenuSection
              loading={loadingMenu}
              error={menuError}
              categories={menu.categories}
              plats={filteredPlats}
              search={search}
              selectedCategory={selectedCategory}
              onSearch={setSearch}
              onCategory={setSelectedCategory}
              onDetails={openDetails}
            />
          </div>
        )}
        {activeView === 'cart' && (
          <CartPage
            tableId={tableId}
            brand={brand}
            cart={cart}
            onOrderCreated={(order) => {
              rememberActiveOrder(order, tableId, true);
              setActiveOrder(order);
              setEditingOrder(null);
              setSnackbar({
                type: 'success',
                title: 'Commande envoyee',
                message: 'Votre suivi de commande est maintenant actif.',
              });
              setActiveView('orders');
            }}
            editingOrder={editingOrder}
            onOrderUpdated={(order) => {
              rememberActiveOrder(order, tableId, true);
              setActiveOrder(order);
              setEditingOrder(null);
              setSnackbar({
                type: 'success',
                title: 'Commande modifiee',
                message: 'Votre modification a ete envoyee au restaurant.',
              });
              setActiveView('orders');
            }}
            onContinueShopping={() => setActiveView('menu')}
          />
        )}
        {activeView === 'orders' && (
          <OrdersPage
            tableId={tableId}
            activeOrder={activeOrder}
            recoveryNotice={recoveryNotice}
            onRecovered={(order) => {
              setRecoveryNotice('');
              rememberActiveOrder(order, tableId, true);
              setActiveOrder(order);
              setSnackbar({
                type: 'success',
                title: 'Commande retrouvee',
                message: 'Votre suivi de commande est de nouveau actif.',
              });
            }}
            onOrderUpdate={setActiveOrder}
            onStatusNotification={(notification) => setSnackbar(notification)}
            onCancellationModal={(order) => setCancelledOrderModal(order)}
            onCancelOrder={async (order) => {
              const reason = window.prompt('Pourquoi voulez-vous annuler cette commande ?');
              if (!reason || reason.trim().length < 3) {
                setSnackbar({
                  type: 'error',
                  title: 'Annulation impossible',
                  message: 'La raison d annulation est obligatoire.',
                });
                return;
              }

              const response = await cancelOrder(order.id, reason.trim());
              setActiveOrder(response.order);
              setCancelledOrderModal(response.order);
              playOrderNotificationSound('error');
              setSnackbar({
                type: 'success',
                title: 'Commande annulee',
                message: 'Votre commande a ete annulee avant preparation.',
              });
            }}
            onEditOrder={(order) => {
              if (order.status !== 'pending' || order.payment_status === 'paid') return;
              cart.replaceItems((order.items ?? []).map((item) => ({
                plat: item.plat,
                quantity: Number(item.quantity ?? 1),
              })).filter((item) => item.plat));
              setEditingOrder(order);
              setActiveView('cart');
            }}
          />
        )}
      </main>
      <ClientChatbot
        brand={brand}
        menu={menu}
        cart={cart}
        activeOrder={activeOrder}
        onOpenMenu={() => setActiveView('menu')}
      />
      <MenuModal plat={selectedPlat} onClose={() => setSelectedPlat(null)} onAdd={cart.addItem} />
      <CancelledOrderModal order={cancelledOrderModal} onClose={() => setCancelledOrderModal(null)} />
      <FeedbackModal
        order={brand.can_feedback ? feedbackOrder : null}
        restaurantName={brand.name}
        onClose={(submitted = false) => {
          if (feedbackOrder?.id) {
            localStorage.setItem(`${FEEDBACK_STORAGE_PREFIX}${feedbackOrder.id}`, submitted ? 'sent' : 'skipped');
          }
          setFeedbackOrder(null);
        }}
        onStatus={(notification) => setSnackbar(notification)}
      />
      <button id="btt" className={backToTop ? 'show' : ''} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <i className="fas fa-chevron-up"></i>
      </button>
      <OrderSnackbar snackbar={snackbar} onClose={() => setSnackbar(null)} />
    </>
  );
}

function TopBar({ brand }) {
  return (
    <div id="topbar">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="top-contact d-flex flex-wrap">
            <span><i className="fas fa-phone-alt"></i>{brand.owner_phone || '+243 830376004'}</span>
            <span><i className="fas fa-utensils"></i>{brand.name}</span>
            <span><i className="fas fa-map-marker-alt"></i>{brand.city || brand.address || 'Restaurant'}</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="ttag"><i className="fas fa-fire me-1"></i>Free Delivery Today!</span>
            <div className="tsoc">
              <a href="#"><i className="fab fa-facebook-f"></i></a>
              <a href="#"><i className="fab fa-instagram"></i></a>
              <a href="#"><i className="fab fa-tiktok"></i></a>
              <a href="#"><i className="fab fa-youtube"></i></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Navbar({ brand, onSearch, cartCount, activeView, activeOrder, onView }) {
  return (
    <nav className="navbar navbar-expand-lg" id="nav">
      <div className="container">
        <button className="navbar-brand clean-btn" type="button" onClick={() => onView('menu')}>
          <BrandLogo brand={brand} />
        </button>
        <div className="navbar-collapse desktop-nav" id="navmenu">
          <ul className="navbar-nav mx-auto">
            {[
              ['menu', 'Menu'],
              ['cart', `Panier (${cartCount})`],
              ['orders', 'Commandes'],
            ].map(([view, label]) => (
              <li className="nav-item" key={view}>
                <button
                  className={`nav-link clean-btn ${activeView === view ? 'active' : ''}`}
                  type="button"
                  onClick={() => onView(view)}
                >
                  {label}
                </button>
              </li>
            ))}
            {activeOrder ? (
              <li className="nav-item">
                <button
                  className="nav-link track-order-link clean-btn"
                  type="button"
                  onClick={() => onView('orders')}
                >
                  <i className="fas fa-bell-concierge me-1"></i>
                  Suivi commande
                  <span>{statusLabels[activeOrder.status] ?? activeOrder.status}</span>
                </button>
              </li>
            ) : null}
          </ul>
          <div className="nav-actions d-flex align-items-center gap-1">
            <button id="navSearchBtn" title="Search" onClick={onSearch}><i className="fas fa-search"></i></button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileBottomNav({ cartCount, activeView, activeOrder, onView }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
      <button type="button" className={`mobile-bottom-item ${activeView === 'menu' ? 'active' : ''}`} onClick={() => onView('menu')}>
        <i className="fas fa-utensils"></i>
        <span>Menu</span>
      </button>
      <button type="button" className={`mobile-bottom-item ${activeView === 'cart' ? 'active' : ''}`} onClick={() => onView('cart')}>
        <span className="mobile-bottom-icon">
          <i className="fas fa-shopping-cart"></i>
          {cartCount > 0 ? <em>{cartCount}</em> : null}
        </span>
        <span>Panier</span>
      </button>
      <button
        type="button"
        className={`mobile-bottom-item ${activeView === 'orders' ? 'active' : ''} ${activeOrder ? 'has-order' : ''}`}
        onClick={() => onView('orders')}
      >
        <i className="fas fa-receipt"></i>
        <span>Commandes</span>
      </button>
    </nav>
  );
}

function BrandLogo({ brand }) {
  return (
    <div className="blogo brand-logo">
      <img className="brand-logo-img" src={brand.logo_url || '/img/logo/e-resto-logo.png'} alt={brand.name || 'E-RESTO'} />
      <div>
        <div className="bname">{brand.name || 'E-RESTO'}</div>
        <div className="bsub">{brand.slogan || brand.description || 'Fast Food & Restaurant'}</div>
      </div>
    </div>
  );
}

function SearchOverlay({ open, value, categories, onChange, onClose, onPickCategory }) {
  return (
    <div id="searchOv" className={open ? 'open' : ''} onClick={(event) => event.target.id === 'searchOv' && onClose()}>
      <button className="sovclose" onClick={onClose}><i className="fas fa-times"></i></button>
      <div className="sovbox">
        <h4>What are you craving today?</h4>
        <div className="sovinput">
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search burgers, pizza, chicken..." autoComplete="off" />
          <button onClick={onClose}><i className="fas fa-search"></i></button>
        </div>
        <div className="sovcats">
          <button className="sovcat active clean-btn" onClick={() => onPickCategory('all')}><img src="/img/menu/1.jpg" alt="" />All Items</button>
          {categories.map((category, index) => (
            <button className="sovcat clean-btn" key={category.id} onClick={() => onPickCategory(category.id)}>
              <img src={assetUrl(category.image_url || category.image, fallbackCategoryImages[index % fallbackCategoryImages.length])} alt="" />
              {category.name}
            </button>
          ))}
        </div>
        <div className="sovtrend">
          <p><i className="fas fa-fire me-1" style={{ color: 'var(--secondary)' }}></i>Trending Searches</p>
          {['Smash Burger', 'Nashville Chicken', 'Truffle Pizza', 'Lava Cake'].map((item) => (
            <button className="ttag clean-btn" key={item} onClick={() => onChange(item)}>{item}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero({ brand }) {
  return (
    <section id="hero">
      <div className="hs hs1"></div>
      <div className="hs hs2"></div>
      <div className="hbgtxt">FOOD</div>
      <div className="container">
        <div className="row align-items-center g-5 hero-row">
          <div className="col-lg-6">
            <div className="hbadge"><div className="hbi"><i className="fas fa-star"></i></div><span>#1 Rated Fast Food Restaurant in New York</span></div>
            <h1 className="htitle">{brand.name || 'Delicious'} <span className="hl">Menu</span><br />for Every Moment</h1>
            {brand.slogan ? <p className="restaurant-slogan">{brand.slogan}</p> : null}
            <p className="hdesc">{brand.description || 'Experience bold flavors crafted from premium ingredients. From crispy burgers to gourmet pizzas - every bite is an adventure worth savoring.'}</p>
            <div className="d-flex flex-wrap gap-3 mb-2">
              <a href="#menu" className="btn-red"><i className="fas fa-utensils"></i>Explore Menu</a>
              <a href="https://www.youtube.com/watch?v=RXv_uIN6e-Y" className="btn-play">
                <div className="pico"><i className="fas fa-play"></i></div><span>Watch Our Story</span>
              </a>
            </div>
            <div className="hstats d-flex gap-3 flex-wrap mt-4">
              {['850+ Happy Customers', '120+ Menu Items', '15+ Expert Chefs', '12yr Experience'].map((stat) => {
                const [number, ...label] = stat.split(' ');
                return <div className="hstat" key={stat}><span className="snum">{number}</span><small>{label.join(' ')}</small></div>;
              })}
            </div>
          </div>
          <div className="col-lg-6">
            <div className="hero-visual">
              <div className="hcircle"><img src="/img/banner-img.jpg" alt="Burger" /></div>
              <div className="fcard fc1"><div className="fcoi r"><i className="fas fa-fire"></i></div><div><span className="fcnum">Hot Deal</span><span className="fcsm">30% off today</span></div></div>
              <div className="fcard fc2"><div className="fcoi y"><i className="fas fa-star"></i></div><div><span className="fcnum">4.9/5</span><span className="fcsm">2k+ reviews</span></div></div>
              <div className="fcard fc3"><div className="fcoi g"><i className="fas fa-clock"></i></div><div><span className="fcnum">20 min</span><span className="fcsm">Fast delivery</span></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ['Crispy Fried Chicken', 'Gourmet Burgers', 'Artisan Pizzas', 'Fresh Wraps & Rolls', 'Loaded Fries', 'Ice Cream Shakes', 'Grilled Sandwiches'];
  return <div className="mqsec"><div className="mqtrack">{[...items, ...items].map((item, index) => <div className="mqitem" key={`${item}-${index}`}><i className="fas fa-circle"></i>{item}</div>)}</div></div>;
}

function CategorySection({ categories, selectedCategory, onSelect }) {
  const visible = categories.length ? categories : [
    { id: 'burgers', name: 'Burgers', plats_count: 24 },
    { id: 'pizza', name: 'Pizza', plats_count: 18 },
    { id: 'chicken', name: 'Fried Chicken', plats_count: 15 },
  ];
  return (
    <section id="category">
      <div className="container">
        <SectionTitle eyebrow="What We Offer" title="Browse by" highlight="Category" description="From sizzling burgers to exotic world cuisines - find your favourite in our menu" />
        <div className="row g-3 justify-content-center">
          <CategoryCard category={{ id: 'all', name: 'All Items', plats_count: visible.reduce((sum, item) => sum + (item.plats_count || 0), 0) }} active={selectedCategory === 'all'} onSelect={onSelect} image="/img/category/1.jpg" />
          {visible.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              active={selectedCategory === category.id}
              onSelect={onSelect}
              image={assetUrl(category.image_url || category.image, fallbackCategoryImages[(index + 1) % fallbackCategoryImages.length])}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ category, active, image, onSelect }) {
  return (
    <div className="col-6 col-sm-4 col-md-3 col-lg-2">
      <button className={`catcard clean-btn ${active ? 'active' : ''}`} onClick={() => {
        onSelect(category.id);
        document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
      }}>
        <img className="catimg" src={image} alt="" />
        <div className="catnm">{category.name}</div>
        <div className="catct">{category.plats_count ?? 0} items</div>
      </button>
    </div>
  );
}

function MenuSection({ loading, error, categories, plats, search, selectedCategory, onSearch, onCategory, onDetails }) {
  return (
    <section id="menu">
      <div className="container">
        <SectionTitle eyebrow="What's Cooking" title="Our Delicious" highlight="Menu" />
        <div className="menu-inline-search">
          <i className="fas fa-search"></i>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Rechercher un plat..."
            autoComplete="off"
          />
          {search ? (
            <button type="button" className="clean-btn" aria-label="Effacer la recherche" onClick={() => onSearch('')}>
              <i className="fas fa-times"></i>
            </button>
          ) : null}
        </div>
        <div className="text-center mb-4">
          <button className={`filtbtn ${selectedCategory === 'all' ? 'active' : ''}`} onClick={() => onCategory('all')}>All</button>
          {categories.map((category) => (
            <button className={`filtbtn ${selectedCategory === category.id ? 'active' : ''}`} key={category.id} onClick={() => onCategory(category.id)}>{category.name}</button>
          ))}
        </div>
        {error && (
          <MenuStateCard
            icon="fa-circle-exclamation"
            title="Menu temporaire"
            message={`${error} Les plats de demonstration restent affiches.`}
          />
        )}
        {loading ? (
          <MenuStateCard
            icon="fa-utensils"
            title="Chargement du menu"
            message="Nous recuperons les plats du restaurant. Patientez quelques secondes."
            loading
          />
        ) : null}
        <div className="row g-4" id="mgrid">
          {plats.map((plat, index) => <MenuCard key={plat.id} plat={plat} index={index} onDetails={onDetails} />)}
          {!loading && plats.length === 0 ? (
            <div className="col-12">
              <MenuStateCard
                icon="fa-bowl-food"
                title="Menu en attente"
                message="La liste des plats n'est pas encore disponible. Essayez une autre categorie ou revenez dans un instant."
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MenuStateCard({ icon, title, message, loading = false }) {
  return (
    <div className={`menu-state-card ${loading ? 'loading' : ''}`}>
      <div className="menu-state-icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}

function MenuCard({ plat, index, onDetails }) {
  const image = assetUrl(plat.image_url || plat.image, fallbackMenuImages[index % fallbackMenuImages.length]);
  return (
    <div className="col-sm-6 col-lg-4 mwrap">
      <button className="mcard clean-btn" onClick={() => onDetails({ ...plat, image_url: image })}>
        <div className="mimg">
          <img src={image} alt={plat.name} />
          <div className="mbdg hot"><i className="fas fa-star"></i> Hot</div>
          <div className="mhrt"><i className="far fa-heart"></i></div>
        </div>
        <div className="mbody">
          <div className="mcat">{plat.category?.name ?? 'Menu'}</div>
          <div className="mtit">{plat.name}</div>
          <div className="mdesc">{plat.description}</div>
          <div className="mfoot">
            <div>
              <div className="mprice">{formatMoney(plat.price, plat.currency)}</div>
              <div className="mtime"><i className="fas fa-clock"></i>{plat.preparation_time ?? 20} min</div>
              <div className="mstars"><i className="fas fa-star"></i> <span style={{ color: '#bbb', fontSize: '.7rem' }}>(128)</span></div>
            </div>
            <span className="madd" title="View Details"><i className="fas fa-plus"></i></span>
          </div>
        </div>
      </button>
    </div>
  );
}

function MenuModal({ plat, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
  }, [plat]);

  if (!plat) return null;

  return (
    <div id="menuPop" className="open" onClick={(event) => event.target.id === 'menuPop' && onClose()}>
      <div className="mpbox">
        <button className="mpclose" onClick={onClose}><i className="fas fa-times"></i></button>
        <div className="row g-4">
          <div className="col-lg-5"><img id="mpImg" className="mpimg" src={plat.image_url} alt={plat.name} /></div>
          <div className="col-lg-7">
            <div className="mcat" id="mpCat">{plat.category?.name ?? 'Menu'}</div>
            <h3 id="mpTitle">{plat.name}</h3>
            <div className="mstars" id="mpStars"><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i> <span>4.9 (128 reviews)</span></div>
            <p id="mpDesc">{plat.description}</p>
            <div className="mpprice" id="mpPrice">{formatMoney(plat.price, plat.currency)}</div>
            <div className="mpmeta" id="mpMeta">
              <div className="mpm"><div className="mpmv">{plat.preparation_time ?? 20} min</div><div className="mpml">Prep Time</div></div>
              <div className="mpm"><div className="mpmv">Fresh</div><div className="mpml">Quality</div></div>
              <div className="mpm"><div className="mpmv">4.9/5</div><div className="mpml">Rating</div></div>
            </div>
            <div id="mpTags">{(plat.ingredients ?? []).map((tag) => <span className="mptag" key={tag}>{tag}</span>)}</div>
            <div className="mpqty">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><i className="fas fa-minus"></i></button>
              <span id="mpQnum">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}><i className="fas fa-plus"></i></button>
            </div>
            <button className="mpaddcart" id="mpAddCart" onClick={() => {
              onAdd(plat, quantity);
              onClose();
            }}><i className="fas fa-shopping-cart"></i>Add to Cart</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartPage({ tableId, brand, cart, onOrderCreated, editingOrder, onOrderUpdated, onContinueShopping }) {
  const [note, setNote] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [mobileWallet, setMobileWallet] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const submittingRef = useRef(false);
  const isMobileMoney = paymentMethod !== 'cash';
  const canSubmit = tableId
    && cart.items.length > 0
    && (!isMobileMoney || mobileWallet.trim())
    && (orderType !== 'takeaway' || customerPhone.trim() || mobileWallet.trim());
  const isEditing = Boolean(editingOrder?.id);
  const allowedPaymentMethods = brand?.payment_methods?.length ? brand.payment_methods : ['cash'];
  const paymentMethods = [
    { key: 'cash', name: 'Cash', icon: 'fa-money-bill-wave', available: true, hint: 'Payez a table ou a la caisse.' },
    { key: 'orange_money', name: 'Orange Money', icon: 'fa-mobile-screen', available: true, hint: 'Interface de paiement mobile money.' },
    { key: 'mpesa', name: 'M-Pesa', icon: 'fa-mobile-screen-button', available: true, hint: 'Interface de paiement mobile money.' },
    { key: 'airtel_money', name: 'Airtel Money', icon: 'fa-sim-card', available: true, hint: 'Interface de paiement mobile money.' },
  ].filter((method) => allowedPaymentMethods.includes(method.key));

  useEffect(() => {
    if (!paymentMethods.some((method) => method.key === paymentMethod)) {
      setPaymentMethod('cash');
      setMobileWallet('');
    }
  }, [paymentMethod, paymentMethods]);

  useEffect(() => {
    if (!editingOrder) return;
    setNote(editingOrder.note || '');
    setOrderType(editingOrder.order_type || 'dine_in');
    setPaymentMethod(editingOrder.payment_method === 'mobile_money'
      ? (editingOrder.payment_provider || 'mpesa')
      : 'cash');
    setMobileWallet(editingOrder.latest_payment?.metadata?.wallet_id || '');
    setCustomerName(editingOrder.customer_name || '');
    setCustomerPhone(editingOrder.customer_phone || '');
    setCustomerEmail(editingOrder.customer_email || '');
    setStatus({ type: 'info', message: 'Vous modifiez votre commande avant preparation.' });
  }, [editingOrder]);

  const submitOrder = async () => {
    if (!canSubmit || submittingRef.current) return;
    prepareCustomerNotifications();
    submittingRef.current = true;
    setStatus({ type: 'loading', message: isEditing ? 'Modification de la commande...' : 'Envoi de la commande...' });
    try {
      const payload = {
        table_id: tableId,
        order_type: orderType,
        note,
        payment_method: paymentMethod,
        payment_provider: paymentMethod === 'cash' ? null : paymentMethod,
        wallet_id: paymentMethod === 'cash' ? null : mobileWallet,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || mobileWallet || undefined,
        customer_email: customerEmail || undefined,
        items: cart.items.map((item) => ({ plat_id: item.plat.id, quantity: item.quantity })),
      };
      const response = isEditing
        ? await updateOrderItems(editingOrder.id, payload)
        : await createOrder(payload);
      cart.clearCart();
      setNote('');
      setOrderType('dine_in');
      setMobileWallet('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setStatus({
        type: response.order?.payment_status === 'failed' ? 'error' : 'success',
        message: response.order?.payment_status === 'failed'
          ? 'Commande envoyee, mais le paiement mobile money a echoue. Vous pouvez payer a la caisse.'
          : isEditing ? 'Commande modifiee avec succes.' : 'Commande envoyee avec succes.'
      });
      if (isEditing) {
        onOrderUpdated(response.order);
      } else {
        onOrderCreated(response.order);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <section className="cart-page app-page" id="cart-page">
      <div className="container">
        <div className="cart-panel-box">
        <div className="app-page-head">
          <span className="slbl">Panier</span>
          <h2>{isEditing ? 'Modifier ma commande' : 'Mon panier'}</h2>
          <button type="button" className="receipt-share-btn" onClick={onContinueShopping}>
            <i className="fas fa-utensils"></i>
            Menu
          </button>
        </div>
        {isEditing && (
          <div className="client-alert info">
            Modification autorisee tant que la commande n'est pas en preparation et pas deja payee.
            <button type="button" className="receipt-share-btn mt-2" onClick={onContinueShopping}>
              <i className="fas fa-plus"></i>
              Ajouter d'autres plats
            </button>
          </div>
        )}
        {!tableId && <div className="client-alert">Scannez un QR code de table pour envoyer la commande au backend.</div>}
        {cart.items.length === 0 ? (
          <div className="empty-page-card compact">
            <i className="fas fa-shopping-cart"></i>
            <strong>Votre panier est vide</strong>
            <span>Ajoutez un plat depuis le menu pour commencer.</span>
          </div>
        ) : cart.items.map((item) => (
          <div className="cart-line" key={item.plat.id}>
            <div>
              <strong>{item.plat.name}</strong>
              <span>{formatMoney(item.plat.price, item.plat.currency)}</span>
            </div>
            <div className="mpqty small">
              <button onClick={() => cart.updateQuantity(item.plat.id, item.quantity - 1)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => cart.updateQuantity(item.plat.id, item.quantity + 1)}>+</button>
            </div>
          </div>
        ))}
        {cart.items.length > 0 && (
          <>
            <textarea className="fctrl" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note pour la cuisine..." />
            <div className="order-type-box">
              <div className="payment-title">
                <strong>Mode de service</strong>
                <span>Le client peut manger a table ou demander a emporter.</span>
              </div>
              <div className="order-type-options">
                <button type="button" className={`order-type-option clean-btn ${orderType === 'dine_in' ? 'active' : ''}`} onClick={() => setOrderType('dine_in')}>
                  <i className="fas fa-utensils"></i>
                  <span>Sur place</span>
                </button>
                <button type="button" className={`order-type-option clean-btn ${orderType === 'takeaway' ? 'active' : ''}`} onClick={() => setOrderType('takeaway')}>
                  <i className="fas fa-bag-shopping"></i>
                  <span>A emporter</span>
                </button>
              </div>
              {orderType === 'takeaway' && (
                <p className="payment-note">Ajoutez un telephone pour que le restaurant puisse identifier la commande a emporter.</p>
              )}
            </div>
            <div className="mobile-money-form">
              <label>Nom du client</label>
              <input className="fctrl" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Votre nom" />
              <label>Telephone pour retrouver la commande</label>
              <input className="fctrl" type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+243 8XX XXX XXX" />
            </div>
            <div className="payment-box">
              <div className="payment-title">
                <strong>Moyen de paiement</strong>
                <span>{brand?.can_mobile_money ? 'Cash et mobile money pour le client du restaurant.' : 'Paiement cash disponible avec ce plan.'}</span>
              </div>
              <div className="payment-options">
                {paymentMethods.map((method) => (
                  <button
                    className={`payment-option clean-btn ${paymentMethod === method.key ? 'active' : ''}`}
                    key={method.key}
                    type="button"
                    onClick={() => setPaymentMethod(method.key)}
                    title={method.hint}
                  >
                    <i className={`fas ${method.icon}`}></i>
                    <span>{method.name}</span>
                    <small>{method.key === 'cash' ? 'A table' : 'Mobile money'}</small>
                  </button>
                ))}
              </div>
              {paymentMethod === 'cash' ? (
                <p className="payment-note success">Votre commande sera envoyee maintenant. Le paiement cash sera confirme par le restaurant.</p>
              ) : (
                <div className="mobile-money-form">
                  <label>Email du client</label>
                  <input className="fctrl" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="client@email.com" />
                  <label>Numero mobile money</label>
                  <input className="fctrl" type="tel" value={mobileWallet} onChange={(event) => setMobileWallet(event.target.value)} placeholder="+243 8XX XXX XXX" />
                  <p className="payment-note">Une demande de validation sera envoyee sur ce numero. Le restaurant verra le paiement en attente jusqu'a confirmation.</p>
                </div>
              )}
            </div>
            <div className="cart-total">
              <span>Total</span>
              <strong>{formatMoney(cart.totals.totalAmount, cart.totals.currency)}</strong>
            </div>
            <button className="btn-red w-100 justify-content-center" disabled={!canSubmit || status.type === 'loading'} onClick={submitOrder}>
              <i className="fas fa-paper-plane"></i>{isEditing ? 'Enregistrer la modification' : (isMobileMoney ? 'Commander et payer' : 'Envoyer la commande')}
            </button>
          </>
        )}
        {status.message && <div className={`client-alert ${status.type}`}>{status.message}</div>}
      </div>
      </div>
    </section>
  );
}

const orderSteps = [
  { key: 'pending', label: 'Commande recue', icon: 'fa-receipt', description: 'Votre commande est bien arrivee en cuisine.' },
  { key: 'preparing', label: 'En preparation', icon: 'fa-fire-burner', description: 'Notre equipe prepare vos plats.' },
  { key: 'ready', label: 'Prete', icon: 'fa-bell', description: 'Votre commande est prete a etre servie.' },
  { key: 'delivered', label: 'Servie', icon: 'fa-utensils', description: 'Bon appetit, votre commande est servie.' },
];

const statusLabels = {
  pending: 'Commande recue',
  preparing: 'En preparation',
  ready: 'Prete',
  delivered: 'Servie',
  cancelled: 'Annulee',
};

const paymentStatusLabels = {
  unpaid: 'Paiement non confirme',
  pending: 'Paiement en attente',
  paid: 'Paiement confirme',
  failed: 'Paiement echoue',
  refunded: 'Paiement rembourse',
};

function OrdersPage({
  tableId,
  activeOrder,
  recoveryNotice,
  onRecovered,
  onOrderUpdate,
  onStatusNotification,
  onCancellationModal,
  onCancelOrder,
  onEditOrder,
}) {
  return (
    <section className="orders-page app-page" id="orders-page">
      <div className="container">
        <div className="app-page-head">
          <span className="slbl">Commandes</span>
          <h2>Suivi de commande</h2>
          {activeOrder ? <span className="order-status-pill compact">{statusLabels[activeOrder.status] ?? activeOrder.status}</span> : null}
        </div>
      </div>
      <OrderRecoverySection
        tableId={tableId}
        activeOrder={activeOrder}
        notice={recoveryNotice}
        onRecovered={onRecovered}
      />
      {!activeOrder ? (
        <div className="container">
          <div className="empty-page-card">
            <i className="fas fa-receipt"></i>
            <strong>Aucune commande active</strong>
            <span>Votre suivi apparaitra ici apres l'envoi du panier.</span>
          </div>
        </div>
      ) : null}
      <OrderStatusTracker
        order={activeOrder}
        tableId={tableId}
        onOrderUpdate={onOrderUpdate}
        onStatusNotification={onStatusNotification}
        onCancellationModal={onCancellationModal}
        onCancelOrder={onCancelOrder}
        onEditOrder={onEditOrder}
      />
      <ReceiptSection order={activeOrder} />
    </section>
  );
}

function getPaymentMethodLabel(order) {
  if (order?.payment_method === 'mobile_money') {
    const provider = String(order.payment_provider || '').replace('_', ' ').trim();
    return provider ? provider.toUpperCase() : 'Mobile Money';
  }

  return order?.payment_method === 'cash' ? 'Cash' : (order?.payment_method || 'Non renseigne');
}

function orderItemsSignature(order) {
  return (order?.items ?? [])
    .map((item) => `${item.plat_id}:${item.quantity}:${item.price_at_order}`)
    .sort()
    .join('|');
}

function hasOrderChanged(previousOrder, nextOrder) {
  if (!previousOrder || !nextOrder) return true;

  return previousOrder.status !== nextOrder.status
    || previousOrder.payment_status !== nextOrder.payment_status
    || Number(previousOrder.total_amount || 0) !== Number(nextOrder.total_amount || 0)
    || previousOrder.note !== nextOrder.note
    || previousOrder.updated_at !== nextOrder.updated_at
    || orderItemsSignature(previousOrder) !== orderItemsSignature(nextOrder);
}

function rememberActiveOrder(order, tableId, syncUrl = false) {
  if (!order?.id) return;

  localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, order.id);
  localStorage.setItem(ACTIVE_ORDER_STATUS_STORAGE_KEY, order.status);
  if (order.tracking_code) {
    localStorage.setItem(ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY, order.tracking_code);
  }

  if (tableId) {
    localStorage.setItem(`${ACTIVE_ORDER_BY_TABLE_PREFIX}${tableId}`, order.id);
  }

  if (syncUrl) {
    const url = new URL(window.location.href);
    if (tableId) {
      url.searchParams.set('table_id', tableId);
    }
    url.searchParams.set('order_id', order.id);
    if (order.tracking_code) {
      url.searchParams.set('tracking_code', order.tracking_code);
    }
    window.history.replaceState({}, '', url.toString());
  }
}

function clearRememberedOrder(tableId) {
  localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY);

  if (tableId) {
    localStorage.removeItem(`${ACTIVE_ORDER_BY_TABLE_PREFIX}${tableId}`);
  }

  const url = new URL(window.location.href);
  if (url.searchParams.has('order_id')) {
    url.searchParams.delete('order_id');
    url.searchParams.delete('tracking_code');
    window.history.replaceState({}, '', url.toString());
  }
}

function trackingLink(order, tableId) {
  const url = new URL(window.location.href);
  if (tableId) {
    url.searchParams.set('table_id', tableId);
  }
  if (order?.id) {
    url.searchParams.set('order_id', order.id);
  }
  if (order?.tracking_code) {
    url.searchParams.set('tracking_code', order.tracking_code);
  }
  return url.toString();
}

function OrderRecoverySection({ tableId, activeOrder, notice, onRecovered }) {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });

  if (activeOrder) return null;

  const recover = async (event) => {
    event.preventDefault();
    if (!code.trim() && !phone.trim()) {
      setStatus({ type: 'error', message: 'Entrez votre code de suivi ou votre numero de telephone.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Recherche de votre commande...' });
    try {
      const order = await trackOrder({
        code: code.trim() || undefined,
        phone: phone.trim() || undefined,
        table_id: tableId || undefined,
      });
      setCode('');
      setPhone('');
      setStatus({ type: '', message: '' });
      onRecovered(order);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Commande introuvable.' });
    }
  };

  return (
    <section className="order-recovery-section">
      <div className="container">
        <form className="order-recovery-card" onSubmit={recover}>
          <div>
            <span className="slbl">Commande en cours</span>
            <h2>Retrouver ma commande</h2>
            <p>{notice || 'Rescannez le QR de la table pour restaurer automatiquement. Le code ou le telephone servent seulement si plusieurs commandes sont actives sur la table.'}</p>
          </div>
          <div className="order-recovery-fields">
            <input className="fctrl" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Code ex: A7K92B" />
            <input className="fctrl" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+243 8XX XXX XXX" />
            <button className="btn-red" type="submit" disabled={status.type === 'loading'}>
              <i className="fas fa-magnifying-glass"></i>
              Retrouver
            </button>
          </div>
          {status.message && <div className={`client-alert ${status.type}`}>{status.message}</div>}
        </form>
      </div>
    </section>
  );
}

function OrderStatusTracker({ order, tableId, onOrderUpdate, onStatusNotification, onCancellationModal, onCancelOrder, onEditOrder }) {
  const [connectionState, setConnectionState] = useState(order ? 'Connexion au suivi...' : '');
  const [cancelling, setCancelling] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(() => notificationAudioUnlocked || getNotificationPermission() === 'granted');
  const [statusBanner, setStatusBanner] = useState(null);
  const lastStatusRef = useRef(null);
  const orderRef = useRef(order);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    if (!order?.id) return undefined;

    let cancelled = false;
    getOrder(order.id)
      .then((freshOrder) => !cancelled && onOrderUpdate(freshOrder))
      .catch(() => undefined);

    const echo = getEcho();
    const channel = echo.channel(`orders.${order.id}`);

    const applyOrderUpdate = (nextOrder) => {
      orderRef.current = nextOrder;
      onOrderUpdate(nextOrder);
    };

    channel.listen('.order.placed', (event) => {
      applyOrderUpdate(event.order);
      setConnectionState('Suivi temps reel active');
    });

    channel.listen('.order.status.updated', (event) => {
      applyOrderUpdate(event.order);
      setConnectionState('Statut mis a jour en direct');
    });

    const connector = echo.connector?.pusher?.connection;
    connector?.bind('connected', () => setConnectionState('Suivi temps reel active'));
    connector?.bind('unavailable', () => setConnectionState('Connexion temps reel indisponible'));
    connector?.bind('error', () => setConnectionState('Connexion temps reel a verifier'));

    const pollingId = window.setInterval(() => {
      getOrder(order.id)
        .then((freshOrder) => {
          if (hasOrderChanged(orderRef.current, freshOrder)) {
            applyOrderUpdate(freshOrder);
            setConnectionState('Statut synchronise');
          }
        })
        .catch(() => undefined);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(pollingId);
      echo.leaveChannel(`orders.${order.id}`);
    };
  }, [order?.id, onOrderUpdate]);

  useEffect(() => {
    if (!order?.id) return;

    rememberActiveOrder(order, tableId);

    const storedStatus = localStorage.getItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);
    const previousStatus = lastStatusRef.current ?? storedStatus;

    if (previousStatus && previousStatus !== order.status) {
      const title = statusLabels[order.status] ?? 'Statut mis a jour';
      const message = getStatusNotificationMessage(order.status);
      const notification = {
        type: order.status === 'cancelled' ? 'error' : 'success',
        title,
        message,
      };

      setStatusBanner(notification);
      onStatusNotification(notification);
      playOrderNotificationSound(notification.type);
      notifyBrowser(title, message);
      if (order.status === 'cancelled') {
        onCancellationModal?.(order);
      }
      document.getElementById('order-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    lastStatusRef.current = order.status;
    rememberActiveOrder(order, tableId);

    if (order.status === 'cancelled' || order.status === 'delivered') {
      clearRememberedOrder(tableId);
    }
  }, [order?.id, order?.status, order?.payment_status, tableId, onStatusNotification]);

  if (!order) return null;

  const currentIndex = orderSteps.findIndex((step) => step.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const activeStep = orderSteps[Math.max(currentIndex, 0)];
  const canClientCancel = order.status === 'pending' && order.payment_status !== 'paid';
  const canClientEdit = order.status === 'pending' && order.payment_status !== 'paid';
  const billAlreadyRequested = Boolean(order.latest_payment?.metadata?.bill_requested);
  const canRequestBill = order.payment_method === 'cash'
    && order.payment_status !== 'paid'
    && order.status === 'delivered';
  const shareUrl = trackingLink(order, tableId);

  const handleCancel = async () => {
    if (!canClientCancel || cancelling) return;
    setCancelling(true);
    try {
      await onCancelOrder?.(order);
    } catch (error) {
      onStatusNotification({
        type: 'error',
        title: 'Annulation impossible',
        message: error.message || "Impossible d'annuler la commande.",
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleEnableAlerts = () => {
    prepareCustomerNotifications();
    playOrderNotificationSound('success');
    setAlertsEnabled(true);
    onStatusNotification({
      type: 'success',
      title: 'Alertes activees',
      message: 'Vous recevrez un son quand le statut de votre commande change.',
    });
  };

  const handleRequestBill = async () => {
    if (!canRequestBill || requestingBill) return;
    setRequestingBill(true);
    try {
      const response = await requestBill(order.id);
      onOrderUpdate(response.order);
      onStatusNotification({
        type: 'success',
        title: 'Addition demandee',
        message: 'Le restaurant a recu votre demande d addition.',
      });
      playOrderNotificationSound('success');
    } catch (error) {
      onStatusNotification({
        type: 'error',
        title: 'Demande impossible',
        message: error.message || "Impossible de demander l'addition.",
      });
    } finally {
      setRequestingBill(false);
    }
  };

  const shareTracking = async () => {
    const text = [
      `Suivi de ma commande E-RESTO`,
      `Code: ${order.tracking_code ?? String(order.id).slice(0, 8).toUpperCase()}`,
      shareUrl,
    ].join('\n');

    if (navigator.share) {
      await navigator.share({ title: 'Suivi commande E-RESTO', text, url: shareUrl });
      return;
    }

    await navigator.clipboard?.writeText(text);
    onStatusNotification({
      type: 'success',
      title: 'Lien copie',
      message: 'Le lien de suivi a ete copie.',
    });
  };

  return (
    <section id="order-tracking" className="order-tracking-section">
      <div className="container">
        <div className={`order-tracker ${isCancelled ? 'cancelled' : ''}`}>
          <div className="order-tracker-head">
            <div>
              <span className="slbl">Live Order Tracking</span>
              <h2>Suivi de votre <span>commande</span></h2>
              <p>{isCancelled ? 'Votre commande a ete annulee.' : activeStep.description}</p>
            </div>
            <div className="order-status-pill">
              <i className={`fas ${isCancelled ? 'fa-ban' : activeStep.icon}`}></i>
              {statusLabels[order.status] ?? order.status}
            </div>
          </div>

          {!alertsEnabled && (
            <div className="order-alerts-box">
              <div>
                <strong>Alertes commande</strong>
                <span>Activez le son et les notifications pour etre prevenu si le statut change.</span>
              </div>
              <button type="button" className="order-alert-button clean-btn" onClick={handleEnableAlerts}>
                <i className="fas fa-volume-high"></i>
                Activer
              </button>
            </div>
          )}

          {statusBanner && (
            <div className={`order-status-banner ${statusBanner.type}`}>
              <div className="order-status-banner-icon">
                <i className={`fas ${statusBanner.type === 'error' ? 'fa-triangle-exclamation' : 'fa-bell'}`}></i>
              </div>
              <div>
                <strong>{statusBanner.title}</strong>
                <span>{statusBanner.message}</span>
              </div>
              <button type="button" className="clean-btn" onClick={() => setStatusBanner(null)} aria-label="Fermer">
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}

          {isCancelled && order.cancellation_reason && (
            <div className="client-alert error">
              Motif d'annulation : {order.cancellation_reason}
            </div>
          )}

          <div className="order-tracker-meta">
            <div>
              <small>Commande</small>
              <strong>#{String(order.id).slice(0, 8).toUpperCase()}</strong>
            </div>
            <div>
              <small>Code suivi</small>
              <strong>{order.tracking_code ?? 'Non disponible'}</strong>
            </div>
            <div>
              <small>Total</small>
              <strong>{formatMoney(order.total_amount, order.currency)}</strong>
            </div>
            <div>
              <small>Connexion</small>
              <strong>{connectionState || 'En attente'}</strong>
            </div>
            <div>
          <small>Paiement</small>
          <strong>{paymentStatusLabels[order.payment_status] ?? order.payment_status ?? 'Non confirme'}</strong>
        </div>
            <div>
              <small>Service</small>
              <strong>{order.order_type === 'takeaway' ? 'A emporter' : 'Sur place'}</strong>
            </div>
      </div>

          <div className="order-steps">
            {orderSteps.map((step, index) => {
              const done = !isCancelled && currentIndex >= index;
              const current = !isCancelled && currentIndex === index;
              return (
                <div className={`order-step ${done ? 'done' : ''} ${current ? 'current' : ''}`} key={step.key}>
                  <div className="order-step-icon"><i className={`fas ${step.icon}`}></i></div>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="order-tracking-share no-print">
            <span>Gardez ce code pour revenir voir le statut si vous fermez la page.</span>
            <button className="receipt-share-btn" type="button" onClick={shareTracking}>
              <i className="fas fa-share-nodes"></i>
              Partager le suivi
            </button>
          </div>

          {canClientCancel && (
            <div className="d-flex flex-wrap gap-2 no-print">
              <button className="btn-red" type="button" onClick={() => onEditOrder?.(order)}>
                <i className="fas fa-pen-to-square"></i>
                Modifier ma commande
              </button>
              <button className="receipt-download-btn" type="button" disabled={cancelling} onClick={handleCancel}>
                <i className="fas fa-ban"></i>
                {cancelling ? 'Annulation...' : 'Annuler ma commande'}
              </button>
            </div>
          )}

          {canRequestBill && (
            <div className="d-flex flex-wrap gap-2 no-print">
              <button className="receipt-share-btn" type="button" disabled={requestingBill || billAlreadyRequested} onClick={handleRequestBill}>
                <i className="fas fa-receipt"></i>
                {billAlreadyRequested ? 'Addition deja demandee' : requestingBill ? 'Demande...' : "Demander l'addition"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReceiptSection({ order }) {
  const [pdfPreview, setPdfPreview] = useState(null);

  useEffect(() => {
    if (order?.payment_status !== 'paid') return undefined;

    const { doc, filename } = buildReceiptPdf(order);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfPreview({ url, filename });

    return () => URL.revokeObjectURL(url);
  }, [order?.id, order?.payment_status]);

  if (order?.payment_status !== 'paid') return null;

  const receiptNumber = `ER-${String(order.id).slice(0, 8).toUpperCase()}`;
  const paidAt = order.updated_at ? new Date(order.updated_at) : new Date();
  const items = order.items ?? [];
  const paymentMethod = getPaymentMethodLabel(order);

  const generatePdf = () => buildReceiptPdf(order);

  const downloadPdf = () => {
    const { doc, filename } = generatePdf();
    doc.save(filename);
  };

  const openPdf = () => {
    const { doc } = generatePdf();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const shareReceipt = async () => {
    const lines = [
      `Recu ${receiptNumber}`,
      `Table: ${order.table?.name ?? 'N/A'}`,
      `Date: ${paidAt.toLocaleString('fr-FR')}`,
      `Moyen de paiement: ${paymentMethod}`,
      '',
      ...items.map((item) => {
        const name = item.plat?.name ?? 'Plat';
        const quantity = item.quantity ?? 1;
        const price = Number(item.price_at_order ?? item.plat?.price ?? 0);
        return `${quantity} x ${name} - ${formatMoney(quantity * price, order.currency)}`;
      }),
      '',
      `Total: ${formatMoney(order.total_amount, order.currency)}`,
      'Merci pour votre visite chez E-RESTO.',
    ];

    const text = lines.join('\n');

    if (navigator.share) {
      await navigator.share({
        title: `Recu E-RESTO ${receiptNumber}`,
        text,
      });
      return;
    }

    await navigator.clipboard?.writeText(text);
  };

  return (
    <section id="receipt" className="receipt-section">
      <div className="container">
        <div className="receipt-shell">
          <div className="receipt-actions no-print">
            <button className="btn-red" onClick={openPdf}>
              <i className="fas fa-file-pdf"></i>Ouvrir le PDF
            </button>
            <button className="receipt-download-btn" onClick={downloadPdf}>
              <i className="fas fa-download"></i>Télécharger
            </button>
            <button className="receipt-share-btn" onClick={shareReceipt}>
              <i className="fas fa-share-nodes"></i>Partager au client
            </button>
          </div>

          <div className="receipt-card" id="paid-receipt">
            <div className="receipt-top">
              <div className="receipt-brand">
                <img src="/img/logo/e-resto-logo.png" alt="E-RESTO" />
                <div>
                  <strong>E-RESTO</strong>
                  <span>Fast Food & Restaurant</span>
                </div>
              </div>
              <div className="receipt-paid">
                <i className="fas fa-circle-check"></i>
                Payee
              </div>
            </div>

            <div className="receipt-title">
              <span>Recu de paiement</span>
              <h2>{receiptNumber}</h2>
              <p>Merci pour votre commande. Voici le recapitulatif complet.</p>
            </div>

            <div className="receipt-meta">
              <div>
                <small>Table</small>
                <strong>{order.table?.name ?? 'N/A'}</strong>
              </div>
              <div>
                <small>Date</small>
                <strong>{paidAt.toLocaleDateString('fr-FR')}</strong>
              </div>
              <div>
                <small>Heure</small>
                <strong>{paidAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
              <div>
                <small>Paiement</small>
                <strong>{paymentMethod}</strong>
              </div>
            </div>

            <div className="receipt-items">
              <div className="receipt-row receipt-head">
                <span>Article</span>
                <span>Qté</span>
                <span>Prix</span>
                <span>Total</span>
              </div>
              {items.map((item) => {
                const price = Number(item.price_at_order ?? item.plat?.price ?? 0);
                const quantity = Number(item.quantity ?? 1);
                return (
                  <div className="receipt-row" key={item.id ?? item.plat_id}>
                    <span>
                      <strong>{item.plat?.name ?? 'Plat'}</strong>
                      <small>{item.plat?.description ?? ''}</small>
                    </span>
                    <span>{quantity}</span>
                    <span>{formatMoney(price, order.currency)}</span>
                    <span>{formatMoney(price * quantity, order.currency)}</span>
                  </div>
                );
              })}
            </div>

            {order.note ? (
              <div className="receipt-note">
                <small>Note client</small>
                <p>{order.note}</p>
              </div>
            ) : null}

            <div className="receipt-total">
              <span>Total paye</span>
              <strong>{formatMoney(order.total_amount, order.currency)}</strong>
            </div>

            <div className="receipt-footer">
              <p>Nous esperons vous revoir bientot chez E-RESTO.</p>
              <span>Recu genere automatiquement par E-RESTO</span>
            </div>
          </div>
        </div>
      </div>
      {pdfPreview ? (
        <div className="receipt-pdf-modal">
          <div className="receipt-pdf-viewer">
            <div className="receipt-pdf-head">
              <div>
                <strong>Reçu PDF généré</strong>
                <span>{pdfPreview.filename}</span>
              </div>
              <button className="clean-btn" onClick={() => setPdfPreview(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <iframe src={pdfPreview.url} title="Reçu PDF E-RESTO"></iframe>
            <div className="receipt-pdf-actions">
              <button className="btn-red" onClick={downloadPdf}>
                <i className="fas fa-download"></i>Télécharger le PDF
              </button>
              <button className="receipt-share-btn" onClick={openPdf}>
                <i className="fas fa-up-right-from-square"></i>Ouvrir dans un onglet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CancelledOrderModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div className="order-modal-backdrop">
      <div className="client-cancel-modal">
        <div className="cancel-modal-icon"><i className="fas fa-ban"></i></div>
        <h2>Commande annulee</h2>
        <p>Votre commande a ete annulee. Voici les details transmis par le restaurant.</p>
        <div className="cancel-modal-summary">
          <div><span>Table</span><strong>{order.table?.name || 'Table inconnue'}</strong></div>
          <div><span>Commande</span><strong>#{String(order.id).slice(0, 8).toUpperCase()}</strong></div>
          <div><span>Total</span><strong>{formatMoney(order.total_amount, order.currency)}</strong></div>
          <div><span>Motif</span><strong>{order.cancellation_reason || 'Non precise'}</strong></div>
        </div>
        <div className="cancel-modal-items">
          {(order.items || []).map((item) => (
            <div key={item.id}>
              <span>x{item.quantity} {item.plat?.name || 'Plat'}</span>
              <strong>{formatMoney(Number(item.price_at_order || item.plat?.price || 0) * Number(item.quantity || 0), order.currency)}</strong>
            </div>
          ))}
        </div>
        <button className="btn-red w-100 justify-content-center" type="button" onClick={onClose}>
          J'ai compris
        </button>
      </div>
    </div>
  );
}

function FeedbackModal({ order, restaurantName, onClose, onStatus }) {
  const [step, setStep] = useState(1);
  const [ratings, setRatings] = useState({ food_rating: 0, service_rating: 0, ordering_rating: 0 });
  const [recommended, setRecommended] = useState(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order?.id) return;
    setStep(1);
    setRatings({ food_rating: 0, service_rating: 0, ordering_rating: 0 });
    setRecommended(null);
    setComment('');
    setError('');
  }, [order?.id]);

  if (!order) return null;

  const ratingRows = [
    { key: 'food_rating', icon: 'fa-utensils', label: 'Qualite des plats' },
    { key: 'service_rating', icon: 'fa-bolt', label: 'Rapidite du service' },
    { key: 'ordering_rating', icon: 'fa-mobile-screen-button', label: 'Facilite de commande' },
  ];
  const canContinue = Object.values(ratings).every((value) => Number(value) > 0);

  const sendFeedback = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await submitFeedback({
        order_id: order.id,
        ...ratings,
        recommended,
        comment: comment.trim() || undefined,
      });
      onStatus?.({
        type: 'success',
        title: 'Merci pour votre avis',
        message: 'Votre feedback a ete transmis au restaurant.',
      });
      onClose(true);
    } catch (feedbackError) {
      setError(feedbackError.message || "Impossible d'envoyer le feedback.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="order-modal-backdrop">
      <div className="feedback-modal">
        {step === 1 ? (
          <>
            <div className="feedback-icon"><i className="fas fa-star"></i></div>
            <h2>Votre repas etait comment ?</h2>
            <p>Notez votre experience chez {restaurantName || 'E-RESTO'}.</p>
            <div className="feedback-rating-list">
              {ratingRows.map((row) => (
                <div className="feedback-rating-row" key={row.key}>
                  <span><i className={`fas ${row.icon}`}></i>{row.label}</span>
                  <div className="feedback-stars">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        type="button"
                        className={`clean-btn ${ratings[row.key] >= value ? 'active' : ''}`}
                        onClick={() => setRatings((current) => ({ ...current, [row.key]: value }))}
                        aria-label={`${value} etoiles`}
                        key={value}
                      >
                        <i className="fas fa-star"></i>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-red w-100 justify-content-center" type="button" disabled={!canContinue} onClick={() => setStep(2)}>
              Continuer <i className="fas fa-arrow-right"></i>
            </button>
            <button className="feedback-skip clean-btn" type="button" onClick={() => onClose(false)}>Passer</button>
          </>
        ) : (
          <>
            <div className="feedback-icon subtle"><i className="fas fa-comment-dots"></i></div>
            <h2>Recommanderiez-vous ce restaurant ?</h2>
            <p>Votre avis aide les autres clients.</p>
            <div className="recommend-options">
              <button type="button" className={`clean-btn ${recommended === true ? 'active' : ''}`} onClick={() => setRecommended(true)}>
                <i className="fas fa-thumbs-up"></i>
                Oui
              </button>
              <button type="button" className={`clean-btn ${recommended === false ? 'active' : ''}`} onClick={() => setRecommended(false)}>
                <i className="fas fa-thumbs-down"></i>
                Non
              </button>
            </div>
            <textarea
              className="fctrl"
              rows="4"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Un commentaire ? Ce que vous avez aime, ce qui pourrait etre ameliore... (optionnel)"
            />
            {error && <div className="client-alert error">{error}</div>}
            <div className="feedback-actions">
              <button className="receipt-share-btn" type="button" onClick={() => setStep(1)}>Retour</button>
              <button className="btn-red" type="button" disabled={sending || recommended === null} onClick={sendFeedback}>
                <i className="fas fa-check"></i>{sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function buildClientBrand(restaurant) {
  const settings = restaurant.settings || {};
  const theme = restaurant.theme || settings.theme || {};
  const defaultNames = ['menu digital', 'e-resto'];
  const customName = String(settings.app_name || '').trim();
  const hasCustomBranding = Boolean(
    restaurant.logo_url
    || settings.slogan
    || (customName && !defaultNames.includes(customName.toLowerCase()))
  );

  return {
    name: hasCustomBranding ? (customName || restaurant.name || 'E-RESTO') : 'E-RESTO',
    slug: restaurant.slug || '',
    logo_url: restaurant.logo_url || '/img/logo/e-resto-logo.png',
    slogan: hasCustomBranding ? (settings.slogan || restaurant.slogan || '') : 'Menu digital pour restaurant',
    description: hasCustomBranding ? (settings.description || restaurant.description || 'Menu digital QR code') : 'Scannez, commandez et suivez votre commande avec E-RESTO.',
    owner_phone: restaurant.owner_phone || '',
    address: restaurant.address || '',
    city: restaurant.city || '',
    can_feedback: Boolean(restaurant.can_feedback),
    can_reservations: Boolean(restaurant.can_reservations),
    can_mobile_money: Boolean(restaurant.can_mobile_money),
    can_chatbot: Boolean(restaurant.can_chatbot),
    payment_methods: Array.isArray(restaurant.payment_methods) ? restaurant.payment_methods : ['cash'],
    theme: {
      primary: theme.primary || '#F9A11B',
      secondary: theme.secondary || '#111111',
      background: theme.background || '#fff7ef',
    },
  };
}

function canShowFeedbackForOrder(order) {
  return order?.status === 'delivered'
    || (order?.order_type === 'takeaway' && order?.status === 'ready');
}

function applyClientTheme(brand) {
  const root = document.documentElement;
  root.style.setProperty('--primary', brand.theme.primary);
  root.style.setProperty('--secondary', brand.theme.secondary);
  root.style.setProperty('--client-bg', brand.theme.background);
}

function getStatusNotificationMessage(status) {
  const messages = {
    pending: 'Votre commande a ete recue par le restaurant.',
    preparing: 'Votre commande est maintenant en preparation.',
    ready: 'Votre commande est prete. Elle arrive bientot.',
    delivered: 'Votre commande a ete servie. Bon appetit.',
    paid: 'Paiement confirme. Merci pour votre visite.',
    cancelled: 'Votre commande a ete annulee.',
  };

  return messages[status] ?? 'Le statut de votre commande a change.';
}

function notifyBrowser(title, message) {
  if (!('Notification' in window)) return;

  const show = () => {
    if (Notification.permission === 'granted') {
      new Notification(`E-RESTO - ${title}`, {
        body: message,
        icon: '/img/logo/e-resto-logo.png',
        badge: '/img/logo/e-resto-logo.png',
        requireInteraction: true,
        vibrate: [160, 80, 160],
      });
    }
  };

  if (Notification.permission === 'default') {
    Notification.requestPermission().then(show);
    return;
  }

  show();
}

function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function prepareCustomerNotifications() {
  unlockNotificationAudio();

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => undefined);
  }
}

function unlockNotificationAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || notificationAudioUnlocked) return;

  notificationAudioContext = notificationAudioContext || new AudioContextClass();

  if (notificationAudioContext.state === 'suspended') {
    notificationAudioContext.resume().catch(() => undefined);
  }

  const oscillator = notificationAudioContext.createOscillator();
  const gain = notificationAudioContext.createGain();
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(notificationAudioContext.destination);
  oscillator.start();
  oscillator.stop(notificationAudioContext.currentTime + 0.03);
  notificationAudioUnlocked = true;
}

function playOrderNotificationSound(type = 'success') {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  notificationAudioContext = notificationAudioContext || new AudioContextClass();

  const play = () => {
    const now = notificationAudioContext.currentTime;
    const frequencies = type === 'error' ? [392, 330] : [660, 880, 740];

    frequencies.forEach((frequency, index) => {
      const oscillator = notificationAudioContext.createOscillator();
      const gain = notificationAudioContext.createGain();
      const startAt = now + (index * 0.14);
      const endAt = startAt + 0.11;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain);
      gain.connect(notificationAudioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt);
    });
  };

  if (notificationAudioContext.state === 'suspended') {
    notificationAudioContext.resume().then(play).catch(() => undefined);
    return;
  }

  play();
}

function OrderSnackbar({ snackbar, onClose }) {
  useEffect(() => {
    const handler = (event) => {
      window.dispatchEvent(new CustomEvent('e-resto-show-snackbar', { detail: event.detail }));
    };
    window.addEventListener('e-resto-order-snackbar', handler);
    return () => window.removeEventListener('e-resto-order-snackbar', handler);
  }, []);

  const [internalSnackbar, setInternalSnackbar] = useState(null);
  const activeSnackbar = snackbar ?? internalSnackbar;

  useEffect(() => {
    const handler = (event) => setInternalSnackbar(event.detail);
    window.addEventListener('e-resto-show-snackbar', handler);
    return () => window.removeEventListener('e-resto-show-snackbar', handler);
  }, []);

  useEffect(() => {
    if (!activeSnackbar) return undefined;
    const timer = setTimeout(() => {
      setInternalSnackbar(null);
      onClose();
    }, 5200);
    return () => clearTimeout(timer);
  }, [activeSnackbar, onClose]);

  if (!activeSnackbar) return null;

  return (
    <div className={`order-snackbar ${activeSnackbar.type ?? 'info'}`}>
      <div className="order-snackbar-icon">
        <i className={`fas ${activeSnackbar.type === 'error' ? 'fa-triangle-exclamation' : activeSnackbar.type === 'success' ? 'fa-circle-check' : 'fa-bell'}`}></i>
      </div>
      <div>
        <strong>{activeSnackbar.title}</strong>
        <span>{activeSnackbar.message}</span>
      </div>
      <button className="clean-btn" onClick={() => {
        setInternalSnackbar(null);
        onClose();
      }}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}

function SectionTitle({ eyebrow, title, highlight, description }) {
  return (
    <div className="text-center mb-5">
      <span className="slbl">{eyebrow}</span>
      <h2 className="stitle">{title} <span>{highlight}</span></h2>
      <div className="sline"></div>
      {description && <p className="sdesc mx-auto section-desc">{description}</p>}
    </div>
  );
}

function ClientChatbot({ brand, menu, cart, activeOrder, onOpenMenu }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: `Bonjour, je suis l'assistant de ${brand.name}. Je peux vous conseiller un plat, expliquer le menu ou vous aider a suivre votre commande.`,
    },
  ]);

  useEffect(() => {
    setMessages((current) => current.length > 1 ? current : [
      {
        from: 'bot',
        text: `Bonjour, je suis l'assistant de ${brand.name}. Je peux vous conseiller un plat, expliquer le menu ou vous aider a suivre votre commande.`,
      },
    ]);
  }, [brand.name]);

  if (!brand.can_chatbot) return null;

  const ask = (question) => {
    const text = (question || input).trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      { from: 'user', text },
      { from: 'bot', text: buildClientChatbotReply(text, brand, menu, cart, activeOrder) },
    ]);
    setInput('');
  };

  return (
    <div className={`client-chatbot ${open ? 'open' : ''}`}>
      {open && (
        <div className="client-chatbot-panel">
          <div className="client-chatbot-head">
            <div>
              <span>Assistant intelligent</span>
              <strong>{brand.name}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer l'assistant">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="client-chatbot-actions">
            <button type="button" onClick={() => ask('Quel plat me recommandes-tu ?')}>Recommandation</button>
            <button type="button" onClick={() => ask('Je veux un plat pas cher')}>Petit budget</button>
            <button type="button" onClick={() => ask('Ou en est ma commande ?')}>Ma commande</button>
          </div>
          <div className="client-chatbot-messages">
            {messages.map((message, index) => (
              <div className={`client-chatbot-message ${message.from === 'user' ? 'user' : ''}`} key={`${message.from}-${index}`}>
                {message.text}
              </div>
            ))}
          </div>
          <div className="client-chatbot-form">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') ask();
              }}
              placeholder="Demandez un conseil..."
            />
            <button type="button" onClick={() => ask()} aria-label="Envoyer">
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
          <button className="client-chatbot-menu" type="button" onClick={onOpenMenu}>
            Voir le menu
          </button>
        </div>
      )}
      <button className="client-chatbot-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <i className="fas fa-sparkles"></i>
        <span>Assistant</span>
      </button>
    </div>
  );
}

function buildClientChatbotReply(question, brand, menu, cart, activeOrder) {
  const normalized = question.toLowerCase();
  const plats = Array.isArray(menu?.plats) ? menu.plats : [];
  const availablePlats = plats.filter((plat) => plat.is_available !== false);
  const cheapest = [...availablePlats].sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0))[0];
  const recommended = availablePlats.find((plat) => {
    const content = `${plat.name} ${plat.description} ${(plat.ingredients ?? []).join(' ')}`.toLowerCase();
    return content.includes('popular') || content.includes('bestseller') || content.includes('chef');
  }) || availablePlats[0];

  if (normalized.includes('pas cher') || normalized.includes('budget') || normalized.includes('moins cher')) {
    return cheapest
      ? `Pour un petit budget, je vous conseille ${cheapest.name} a ${formatMoney(cheapest.price, cheapest.currency || 'CDF')}.`
      : 'Je ne vois pas encore les prix du menu. Ouvrez la section Menu pour choisir selon votre budget.';
  }

  if (normalized.includes('recommande') || normalized.includes('populaire') || normalized.includes('meilleur')) {
    return recommended
      ? `Je vous recommande ${recommended.name}. ${recommended.description || 'C est un bon choix pour decouvrir le menu.'}`
      : 'Le menu est en cours de chargement. Revenez dans un instant et je pourrai vous conseiller.';
  }

  if (normalized.includes('commande') || normalized.includes('suivi') || normalized.includes('statut')) {
    if (activeOrder) {
      return `Votre commande est actuellement : ${statusLabels[activeOrder.status] ?? activeOrder.status}. Gardez cette page ouverte pour le suivi en temps reel.`;
    }
    return 'Vous n avez pas encore de commande active sur cette page. Ajoutez des plats au panier puis envoyez la commande.';
  }

  if (normalized.includes('panier')) {
    return cart.totals.totalQuantity > 0
      ? `Votre panier contient ${cart.totals.totalQuantity} article(s), total ${formatMoney(cart.totals.totalAmount, cart.totals.currency)}.`
      : 'Votre panier est vide. Je peux vous recommander un plat pour commencer.';
  }

  if (normalized.includes('reservation') || normalized.includes('reserver')) {
    return brand.can_reservations
      ? 'Les reservations sont disponibles. Descendez a la section Reservation pour envoyer votre demande au restaurant.'
      : 'Ce restaurant n a pas active les reservations sur son plan actuel.';
  }

  if (normalized.includes('allerg')) {
    return 'Pour les allergies, verifiez la description du plat et precisez votre contrainte dans la note de commande. En cas de doute, appelez le restaurant avant de valider.';
  }

  return `Je peux vous aider a choisir un plat chez ${brand.name}, suivre votre commande, comprendre le menu ou trouver une option adaptee a votre budget.`;
}
