import { useEffect, useMemo, useRef, useState } from 'react';
import { createOrder, getOrder } from '../features/cart/orderApi';
import { buildReceiptPdf } from '../features/cart/receiptPdf';
import { useCart } from '../features/cart/useCart';
import { sendContactMessage } from '../features/contact/contactApi';
import { getPublicMenu } from '../features/menu/menuApi';
import { createReservation } from '../features/reservation/reservationApi';
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

export function App() {
  const tableId = useTableId();
  const cart = useCart();
  const [menu, setMenu] = useState({ categories: [], plats: [] });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPlat, setSelectedPlat] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [backToTop, setBackToTop] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState('');

  useEffect(() => {
    getPublicMenu()
      .then(setMenu)
      .catch(() => {
        setMenuError("Le menu backend n'est pas disponible pour le moment.");
        setMenu({
          categories: [
            { id: 'burgers', name: 'Burgers', plats_count: 1 },
            { id: 'pizza', name: 'Pizza', plats_count: 1 },
            { id: 'chicken', name: 'Fried Chicken', plats_count: 1 },
          ],
          plats: staticPlats,
        });
      })
      .finally(() => setLoadingMenu(false));
  }, []);

  useEffect(() => {
    const storedOrderId = localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
    if (!storedOrderId) return;

    const storedStatus = localStorage.getItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);

    getOrder(storedOrderId)
      .then((order) => {
        setActiveOrder(order);
        localStorage.setItem(ACTIVE_ORDER_STATUS_STORAGE_KEY, order.status);

        if (storedStatus && storedStatus !== order.status) {
          setSnackbar({
            type: order.status === 'cancelled' ? 'error' : 'success',
            title: statusLabels[order.status] ?? 'Statut mis a jour',
            message: getStatusNotificationMessage(order.status),
          });
        } else {
          setSnackbar({
            type: 'info',
            title: 'Suivi restaure',
            message: `Votre commande est toujours ${statusLabels[order.status]?.toLowerCase() ?? order.status}.`,
          });
        }
      })
      .catch(() => {
        localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);
      });
  }, []);

  useEffect(() => {
    const onScroll = () => {
      document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 60);
      setBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filteredPlats = menu.plats.filter((plat) => {
    const matchesCategory = selectedCategory === 'all' || plat.category?.id === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${plat.name} ${plat.description}`.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const openDetails = (plat) => setSelectedPlat(plat);

  return (
    <>
      <TopBar />
      <Navbar
        onSearch={() => setSearchOpen(true)}
        cartCount={cart.totals.totalQuantity}
        activeOrder={activeOrder}
        onTrackOrder={() => {
          document.getElementById('order-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onCart={() => setCartOpen(true)}
      />
      <SearchOverlay
        open={searchOpen}
        value={search}
        categories={menu.categories}
        onChange={setSearch}
        onClose={() => setSearchOpen(false)}
        onPickCategory={(id) => {
          setSelectedCategory(id);
          setSearchOpen(false);
          document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <Hero />
      <Marquee />
      <CategorySection
        categories={menu.categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <AboutSection />
      <MenuSection
        loading={loadingMenu}
        error={menuError}
        categories={menu.categories}
        plats={filteredPlats}
        selectedCategory={selectedCategory}
        onCategory={setSelectedCategory}
        onDetails={openDetails}
      />
      <DealSection />
      <GallerySection />
      <ChefsSection />
      <TestimonialsSection />
      <ReservationSection tableId={tableId} />
      <OrderStatusTracker
        order={activeOrder}
        onOrderUpdate={setActiveOrder}
        onStatusNotification={(notification) => setSnackbar(notification)}
      />
      <ReceiptSection order={activeOrder} />
      <BlogSection />
      <NewsletterSection />
      <ContactSection />
      <Footer />
      <MenuModal plat={selectedPlat} onClose={() => setSelectedPlat(null)} onAdd={cart.addItem} />
      <CartDrawer
        open={cartOpen}
        tableId={tableId}
        cart={cart}
        onOrderCreated={(order) => {
          localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, order.id);
          localStorage.setItem(ACTIVE_ORDER_STATUS_STORAGE_KEY, order.status);
          setActiveOrder(order);
          setSnackbar({
            type: 'success',
            title: 'Commande envoyee',
            message: 'Votre suivi de commande est maintenant actif.',
          });
          setCartOpen(false);
          setTimeout(() => {
            document.getElementById('order-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        }}
        onClose={() => setCartOpen(false)}
      />
      <button id="btt" className={backToTop ? 'show' : ''} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <i className="fas fa-chevron-up"></i>
      </button>
      <OrderSnackbar snackbar={snackbar} onClose={() => setSnackbar(null)} />
    </>
  );
}

function TopBar() {
  return (
    <div id="topbar">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="top-contact d-flex flex-wrap">
            <span><i className="fas fa-phone-alt"></i>+243 830376004</span>
            <span><i className="fas fa-envelope"></i>e.resto2025@gmail.com</span>
            <span><i className="fas fa-map-marker-alt"></i>Bandalugwa</span>
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

function Navbar({ onSearch, cartCount, activeOrder, onTrackOrder, onCart }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', drawerOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [drawerOpen]);

  return (
    <nav className="navbar navbar-expand-lg" id="nav">
      <div className="container">
        <a className="navbar-brand" href="#hero">
          <BrandLogo />
        </a>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <i className={`fas ${drawerOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>
        <button
          className={`mobile-drawer-backdrop clean-btn ${drawerOpen ? 'open' : ''}`}
          aria-label="Close navigation menu"
          onClick={closeDrawer}
        ></button>
        <div className={`navbar-collapse mobile-drawer ${drawerOpen ? 'open' : ''}`} id="navmenu">
          <div className="mobile-drawer-head">
            <BrandLogo />
            <button className="mobile-drawer-close" type="button" aria-label="Close navigation menu" onClick={closeDrawer}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <ul className="navbar-nav mx-auto">
            {[
              ['#hero', 'Home'],
              ['#about', 'About'],
              ['#menu', 'Menu'],
              ['#chefs', 'Chefs'],
              ['#reservation', 'Reservation'],
              ['#testimonials', 'Reviews'],
              ['#contact-section', 'Contact'],
            ].map(([href, label]) => (
              <li className="nav-item" key={href}><a className="nav-link" href={href} onClick={closeDrawer}>{label}</a></li>
            ))}
            {activeOrder ? (
              <li className="nav-item">
                <button
                  className="nav-link track-order-link clean-btn"
                  type="button"
                  onClick={() => {
                    closeDrawer();
                    onTrackOrder();
                  }}
                >
                  <i className="fas fa-bell-concierge me-1"></i>
                  Suivi commande
                  <span>{statusLabels[activeOrder.status] ?? activeOrder.status}</span>
                </button>
              </li>
            ) : null}
          </ul>
          <div className="nav-actions d-flex align-items-center gap-1">
            <button id="navSearchBtn" title="Search" onClick={() => {
              closeDrawer();
              onSearch();
            }}><i className="fas fa-search"></i></button>
            <button className="nav-link nav-cta clean-btn" onClick={() => {
              closeDrawer();
              onCart();
            }}>
              <i className="fas fa-shopping-bag me-1"></i>My Cart ({cartCount})
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function BrandLogo() {
  return (
    <div className="blogo brand-logo">
      <img className="brand-logo-img" src="/img/logo/e-resto-logo.png" alt="E-RESTO" />
      <div>
        <div className="bname">E-<span>RESTO</span></div>
        <div className="bsub">Fast Food & Restaurant</div>
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

function Hero() {
  return (
    <section id="hero">
      <div className="hs hs1"></div>
      <div className="hs hs2"></div>
      <div className="hbgtxt">FOOD</div>
      <div className="container">
        <div className="row align-items-center g-5 hero-row">
          <div className="col-lg-6">
            <div className="hbadge"><div className="hbi"><i className="fas fa-star"></i></div><span>#1 Rated Fast Food Restaurant in New York</span></div>
            <h1 className="htitle">Delicious <span className="hl">Fast Food</span><br />for Every Moment</h1>
            <p className="hdesc">Experience bold flavors crafted from premium ingredients. From crispy burgers to gourmet pizzas - every bite is an adventure worth savoring.</p>
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

function AboutSection() {
  return (
    <section id="about">
      <div className="container">
        <div className="row align-items-center g-5">
          <div className="col-lg-5">
            <div className="astack">
              <div className="aexp"><span className="anum">12+</span><small>Years of<br />Excellence</small></div>
              <div className="amain"><img src="/img/about1.jpg" alt="Restaurant" /></div>
              <div className="asm"><img src="/img/about2.jpg" alt="" /></div>
            </div>
          </div>
          <div className="col-lg-7">
            <span className="slbl">Our Story</span>
            <h2 className="stitle text-start">We Invite You to Visit<br />Our <span>Food Restaurant</span></h2>
            <div className="sline lft"></div>
            <p className="sdesc mb-4">Founded in 2012, Sarab began as a small corner joint with a big dream - to serve food that brings people together.</p>
            {[
              ['leaf', '100% Fresh Ingredients', 'We source locally and sustainably for maximum freshness.'],
              ['award', 'Award-Winning Recipes', 'Our signature recipes are crafted with care and consistency.'],
              ['shipping-fast', 'Lightning-Fast Delivery', 'Order online and get hot, fresh food without the wait.'],
            ].map(([icon, title, text]) => (
              <div className="fti" key={title}>
                <div className="ftico r"><i className={`fas fa-${icon}`}></i></div>
                <div><h6>{title}</h6><p>{text}</p></div>
              </div>
            ))}
            <a href="#menu" className="btn-red"><i className="fas fa-book-open"></i>View Full Menu</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function MenuSection({ loading, error, categories, plats, selectedCategory, onCategory, onDetails }) {
  return (
    <section id="menu">
      <div className="container">
        <SectionTitle eyebrow="What's Cooking" title="Our Delicious" highlight="Menu" />
        <div className="text-center mb-4">
          <button className={`filtbtn ${selectedCategory === 'all' ? 'active' : ''}`} onClick={() => onCategory('all')}>All</button>
          {categories.map((category) => (
            <button className={`filtbtn ${selectedCategory === category.id ? 'active' : ''}`} key={category.id} onClick={() => onCategory(category.id)}>{category.name}</button>
          ))}
        </div>
        {error && <div className="client-alert">{error} Les plats de demonstration restent affiches.</div>}
        {loading ? <div className="client-alert">Chargement du menu...</div> : null}
        <div className="row g-4" id="mgrid">
          {plats.map((plat, index) => <MenuCard key={plat.id} plat={plat} index={index} onDetails={onDetails} />)}
          {!loading && plats.length === 0 ? <div className="col-12"><div className="client-alert">Aucun plat disponible dans cette categorie.</div></div> : null}
        </div>
      </div>
    </section>
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

function CartDrawer({ open, tableId, cart, onClose, onOrderCreated }) {
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [status, setStatus] = useState({ type: '', message: '' });
  const canSubmit = tableId && cart.items.length > 0;
  const paymentMethods = [
    { key: 'cash', name: 'Cash', icon: 'fa-money-bill-wave', available: true, hint: 'Payez a table ou a la caisse.' },
    { key: 'orange_money', name: 'Orange Money', icon: 'fa-mobile-screen', available: true, hint: 'Interface de paiement mobile money.' },
    { key: 'mpesa', name: 'M-Pesa', icon: 'fa-mobile-screen-button', available: true, hint: 'Interface de paiement mobile money.' },
    { key: 'airtel_money', name: 'Airtel Money', icon: 'fa-sim-card', available: true, hint: 'Interface de paiement mobile money.' },
  ];

  const submitOrder = async () => {
    if (!canSubmit) return;
    setStatus({ type: 'loading', message: 'Envoi de la commande...' });
    try {
      const response = await createOrder({
        table_id: tableId,
        note,
        payment_method: paymentMethod,
        payment_provider: paymentMethod === 'cash' ? null : paymentMethod,
        items: cart.items.map((item) => ({ plat_id: item.plat.id, quantity: item.quantity })),
      });
      cart.clearCart();
      setNote('');
      setStatus({ type: 'success', message: 'Commande envoyee avec succes.' });
      onOrderCreated(response.order);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <div className={`cart-panel ${open ? 'open' : ''}`}>
      <div className="cart-panel-box">
        <button className="mpclose" onClick={onClose}><i className="fas fa-times"></i></button>
        <h3>My Cart</h3>
        {!tableId && <div className="client-alert">Scannez un QR code de table pour envoyer la commande au backend.</div>}
        {cart.items.length === 0 ? <p className="sdesc">Votre panier est vide.</p> : cart.items.map((item) => (
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
        <textarea className="fctrl" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note pour la cuisine..." />
        <div className="payment-box">
          <div className="payment-title">
            <strong>Moyen de paiement</strong>
            <span>Cash et mobile money pour le client du restaurant.</span>
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
              <label>Numero mobile money</label>
              <input className="fctrl" type="tel" placeholder="+243 8XX XXX XXX" />
              <p className="payment-note">Interface de test : la commande part avec le moyen choisi, l'API fournisseur sera branchee ensuite.</p>
            </div>
          )}
        </div>
        <div className="cart-total">
          <span>Total</span>
          <strong>{formatMoney(cart.totals.totalAmount, cart.totals.currency)}</strong>
        </div>
        <button className="btn-red w-100 justify-content-center" disabled={!canSubmit || status.type === 'loading'} onClick={submitOrder}>
          <i className="fas fa-paper-plane"></i>Envoyer la commande
        </button>
        {status.message && <div className={`client-alert ${status.type}`}>{status.message}</div>}
      </div>
    </div>
  );
}

const orderSteps = [
  { key: 'pending', label: 'Commande recue', icon: 'fa-receipt', description: 'Votre commande est bien arrivee en cuisine.' },
  { key: 'preparing', label: 'En preparation', icon: 'fa-fire-burner', description: 'Notre equipe prepare vos plats.' },
  { key: 'ready', label: 'Prete', icon: 'fa-bell', description: 'Votre commande est prete a etre servie.' },
  { key: 'delivered', label: 'Servie', icon: 'fa-utensils', description: 'Bon appetit, votre commande est servie.' },
  { key: 'paid', label: 'Payee', icon: 'fa-circle-check', description: 'Paiement confirme. Merci pour votre visite.' },
];

const statusLabels = {
  pending: 'Commande recue',
  preparing: 'En preparation',
  ready: 'Prete',
  delivered: 'Servie',
  paid: 'Payee',
  cancelled: 'Annulee',
};

function OrderStatusTracker({ order, onOrderUpdate, onStatusNotification }) {
  const [connectionState, setConnectionState] = useState(order ? 'Connexion au suivi...' : '');
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
          if (orderRef.current?.status !== freshOrder.status) {
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

    localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, order.id);

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

      onStatusNotification(notification);
      notifyBrowser(title, message);
    }

    lastStatusRef.current = order.status;
    localStorage.setItem(ACTIVE_ORDER_STATUS_STORAGE_KEY, order.status);

    if (['paid', 'cancelled'].includes(order.status)) {
      localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);
    }
  }, [order?.id, order?.status, onStatusNotification]);

  if (!order) return null;

  const currentIndex = orderSteps.findIndex((step) => step.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const activeStep = orderSteps[Math.max(currentIndex, 0)];

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

          <div className="order-tracker-meta">
            <div>
              <small>Commande</small>
              <strong>#{String(order.id).slice(0, 8).toUpperCase()}</strong>
            </div>
            <div>
              <small>Total</small>
              <strong>{formatMoney(order.total_amount, order.currency)}</strong>
            </div>
            <div>
              <small>Connexion</small>
              <strong>{connectionState || 'En attente'}</strong>
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
        </div>
      </div>
    </section>
  );
}

function ReceiptSection({ order }) {
  const [pdfPreview, setPdfPreview] = useState(null);

  useEffect(() => {
    if (order?.status !== 'paid') return undefined;

    const { doc, filename } = buildReceiptPdf(order);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfPreview({ url, filename });

    return () => URL.revokeObjectURL(url);
  }, [order?.id, order?.status]);

  if (order?.status !== 'paid') return null;

  const receiptNumber = `ER-${String(order.id).slice(0, 8).toUpperCase()}`;
  const paidAt = order.updated_at ? new Date(order.updated_at) : new Date();
  const items = order.items ?? [];

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
                <small>Statut</small>
                <strong>Paiement confirme</strong>
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
      });
    }
  };

  if (Notification.permission === 'default') {
    Notification.requestPermission().then(show);
    return;
  }

  show();
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

function ReservationSection({ tableId }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', guests: '2', reservation_date: '', reservation_time: '19:00', special_requests: '' });
  const [status, setStatus] = useState({ type: '', message: '' });

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Reservation en cours...' });
    try {
      await createReservation({ ...form, table_id: tableId || null, guests: Number(form.guests) });
      setStatus({ type: 'success', message: "Table reservee ! Nous confirmerons par email." });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <section id="reservation">
      <div className="container">
        <SectionTitle eyebrow="Book a Table" title="Make a" highlight="Reservation" description="Reserve your table for a memorable dining experience." />
        <div className="row g-4 align-items-start">
          <InfoPanel />
          <div className="col-lg-8">
            <form className="fcard" onSubmit={submit}>
              <div className="row g-3">
                <FormInput label="Full Name *" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
                <FormInput label="Phone Number *" type="tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} required />
                <FormInput label="Email Address *" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
                <div className="col-sm-6"><label className="flbl">Number of Guests *</label><input className="fctrl" type="number" min="1" max="50" value={form.guests} onChange={(event) => setForm({ ...form, guests: event.target.value })} /></div>
                <FormInput label="Date *" type="date" value={form.reservation_date} onChange={(reservation_date) => setForm({ ...form, reservation_date })} required />
                <FormInput label="Time *" type="time" value={form.reservation_time} onChange={(reservation_time) => setForm({ ...form, reservation_time })} required />
                <div className="col-12"><label className="flbl">Special Requests</label><textarea className="fctrl" rows="3" value={form.special_requests} onChange={(event) => setForm({ ...form, special_requests: event.target.value })} placeholder="Allergies, dietary needs, special occasions..." /></div>
                <div className="col-12"><button className="btn-red w-100 justify-content-center" disabled={status.type === 'loading'}><i className="fas fa-calendar-check"></i>Confirm Reservation</button></div>
              </div>
              {status.message && <div className={`sucmsg visible ${status.type}`}><i className="fas fa-check-circle"></i><p>{status.message}</p></div>}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: 'General Inquiry', message: '' });
  const [status, setStatus] = useState({ type: '', message: '' });

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ type: 'loading', message: 'Envoi du message...' });
    try {
      await sendContactMessage(form);
      setForm({ name: '', email: '', phone: '', subject: 'General Inquiry', message: '' });
      setStatus({ type: 'success', message: "Message envoye ! Nous repondrons rapidement." });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <section id="contact-section">
      <div className="container">
        <SectionTitle eyebrow="Get In Touch" title="Contact" highlight="Us" description="Have a question, feedback, or want to plan a special event? We'd love to hear from you." />
        <div className="row g-4">
          <div className="col-lg-4"><ContactInfo /></div>
          <div className="col-lg-8">
            <form className="fcard" onSubmit={submit}>
              <div className="row g-3">
                <FormInput label="Your Name *" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
                <FormInput label="Email Address *" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
                <FormInput label="Phone Number" type="tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
                <div className="col-sm-6"><label className="flbl">Subject *</label><select className="fctrl" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>{['General Inquiry', 'Catering & Events', 'Feedback', 'Partnership', 'Media & Press'].map((item) => <option key={item}>{item}</option>)}</select></div>
                <div className="col-12"><label className="flbl">Message *</label><textarea className="fctrl" rows="5" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required placeholder="Write your message here..." /></div>
                <div className="col-12"><button className="btn-red" disabled={status.type === 'loading'}><i className="fas fa-paper-plane"></i>Send Message</button></div>
              </div>
              {status.message && <div className={`sucmsg visible ${status.type}`}><i className="fas fa-check-circle"></i><p>{status.message}</p></div>}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormInput({ label, value, onChange, type = 'text', required = false }) {
  return <div className="col-sm-6"><label className="flbl">{label}</label><input className="fctrl" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
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

function InfoPanel() {
  return (
    <div className="col-lg-4">
      <div className="ctdark">
        <h4>Contact Info</h4>
        <p className="ctsub">We're happy to help you plan the perfect dining experience.</p>
        {[
          ['clock', 'Opening Hours', 'Wed - Sun, 9 AM - 11 PM'],
          ['phone-alt', 'Call for Booking', '+243 830376004'],
          ['users', 'Group Dining', 'Special menus for 10+ guests'],
          ['map-marker-alt', 'Location', '42 Flavor Street, NY'],
        ].map(([icon, title, text]) => (
          <div className="ctitem" key={title}><div className="cticon"><i className={`fas fa-${icon}`}></i></div><div className="ctinfo"><strong>{title}</strong><span>{text}</span></div></div>
        ))}
      </div>
    </div>
  );
}

function ContactInfo() {
  return (
    <div className="ctdark">
      <h4>Let's Talk</h4>
      <p className="ctsub">We typically respond within 2 hours during business hours.</p>
      {[
        ['map-marker-alt', 'Address', '42 Flavor Street, Manhattan, New York, NY 10001'],
        ['phone-alt', 'Phone', '+243 830376004'],
        ['envelope', 'Email', 'e.resto2025@gmail.com'],
        ['clock', 'Working Hours', 'Wed - Sun: 9 AM - 11 PM'],
      ].map(([icon, title, text]) => <div className="ctitem" key={title}><div className="cticon"><i className={`fas fa-${icon}`}></i></div><div className="ctinfo"><strong>{title}</strong><span>{text}</span></div></div>)}
    </div>
  );
}

function DealSection() {
  return <section id="offer"><div className="container"><div className="offerwrap"><div><span className="slbl">Limited Offer</span><h2>Get 30% Off Today</h2><p>Fresh burgers, crispy chicken and artisan pizza prepared in minutes.</p><a href="#menu" className="btn-red"><i className="fas fa-shopping-cart"></i>Grab the Deal</a></div><img src="/img/off-img.jpg" alt="Special offer" /></div></div></section>;
}

function GallerySection() {
  return (
    <section id="gallery">
      <div className="container">
        <SectionTitle eyebrow="Our Gallery" title="Fresh Food" highlight="Moments" />
        <div className="row g-4">
          {[1, 2, 3, 4, 5].map((item) => <div className="col-sm-6 col-lg-4" key={item}><div className="gitem"><img src={`/img/portfolio/work${item}.jpg`} alt="" /></div></div>)}
        </div>
      </div>
    </section>
  );
}

function ChefsSection() {
  return <section id="chefs"><div className="container"><SectionTitle eyebrow="Our Team" title="Meet Our Expert" highlight="Chefs" /><div className="row g-4">{[1, 2, 3, 4].map((item) => <div className="col-sm-6 col-lg-3" key={item}><div className="chcard"><img src={`/img/chefs/${item}.jpg`} alt="" /><div className="chbody"><h5>Chef {item}</h5><div className="chrole">Executive Chef</div></div></div></div>)}</div></div></section>;
}

function TestimonialsSection() {
  return <section id="testimonials"><div className="container"><SectionTitle eyebrow="Testimonials" title="Happy Customer" highlight="Reviews" /><div className="row g-4">{[1, 2, 3].map((item) => <div className="col-md-4" key={item}><div className="tcard"><div className="tstars">★★★★★</div><p>Fantastic food, fast service and beautiful experience.</p><div className="tauth"><img src={`/img/testimonial/${item}.jpg`} alt="" /><div><strong>Customer {item}</strong><span>Food lover</span></div></div></div></div>)}</div></div></section>;
}

function BlogSection() {
  return <section id="blog"><div className="container"><SectionTitle eyebrow="News & Updates" title="Our Latest" highlight="Blog Posts" /><div className="row g-4">{[1, 2, 3].map((item) => <div className="col-md-6 col-lg-4" key={item}><div className="blcard"><div className="blimg"><img src={`/img/blog/${item}.jpg`} alt="" /></div><div className="blbody"><div className="bltag">Food & Health</div><div className="bltit"><a href="#">Healthy Fast Food and Fresh Ideas</a></div><a href="#" className="blmore">Read More <i className="fas fa-arrow-right"></i></a></div></div></div>)}</div></div></section>;
}

function NewsletterSection() {
  return <section id="newsletter"><div className="nlbg"></div><div className="container"><div className="nlw text-center"><span className="slbl" style={{ color: 'rgba(255,255,255,.7)' }}>Stay Connected</span><h2 className="mb-3" style={{ color: '#fff' }}>Subscribe & Get Exclusive <span style={{ color: 'var(--secondary)' }}>Deals</span></h2><p className="mb-4" style={{ color: 'rgba(255,255,255,.78)' }}>Get 15% off your first order plus early access to new menu items</p><div className="nl-form-wrap"><input className="nlinput" type="email" placeholder="Enter your email address..." /><button className="nlbtn"><i className="fas fa-paper-plane me-1"></i>Subscribe</button></div></div></div></section>;
}

function Footer() {
  return <footer><div className="container"><div className="row g-5"><div className="col-lg-4"><div className="footer-brand"><img src="/img/logo/e-resto-logo.png" alt="E-RESTO" /><div className="fnm">E-<span>RESTO</span></div></div><p className="fdesc">We bring the world's finest flavors together in a fast, friendly, and affordable experience.</p></div><div className="col-sm-6 col-lg-2"><div className="ftit">Quick Links</div><ul className="flinks ps-0"><li><a href="#hero"><i className="fas fa-chevron-right"></i>Home</a></li><li><a href="#menu"><i className="fas fa-chevron-right"></i>Our Menu</a></li><li><a href="#reservation"><i className="fas fa-chevron-right"></i>Reservation</a></li></ul></div><div className="col-lg-4"><div className="ftit">Get In Touch</div><div className="fci"><div className="fciico"><i className="fas fa-map-marker-alt"></i></div><div className="fciinfo"><strong>Address</strong>42 Flavor Street, Manhattan, NY 10001</div></div></div></div></div><div className="fbot"><div className="container"><p>&copy; 2026 <span>E-RESTO Restaurant</span>. All Rights Reserved.</p></div></div></footer>;
}
