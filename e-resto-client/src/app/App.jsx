import { useEffect, useMemo, useRef, useState } from 'react';
import { cancelOrder, createOrder, getOrder, requestBill, trackOrder, updateOrderItems } from '../features/cart/orderApi';
import { checkoutGroupOrder, createGroupOrder, deleteGroupOrderItem, getActiveGroupOrderByTable, getGroupOrder, heartbeatGroupOrderParticipant, joinGroupOrder, setGroupOrderParticipantReady, upsertGroupOrderItem } from '../features/cart/groupOrderApi';
import { buildReceiptPdf } from '../features/cart/receiptPdf';
import { useCart } from '../features/cart/useCart';
import { getFeedbackAvailability, submitFeedback } from '../features/feedback/feedbackApi';
import { createTableSession, getPublicMenu } from '../features/menu/menuApi';
import { createReservation } from '../features/reservation/reservationApi';
import { subscribeToGroupOrderRealtime, subscribeToMenuRealtime, subscribeToOrderRealtime } from '../shared/api/realtime';
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

function hasActivePromotion(plat) {
  return Boolean(plat?.is_promotion_active && Number(plat?.promotion_percent) > 0 && Number(plat?.promotion_price) > 0);
}

function effectiveDishPrice(plat) {
  return hasActivePromotion(plat) ? Number(plat.promotion_price) : Number(plat?.price || 0);
}

function promotionEndLabel(plat) {
  if (!plat?.promotion_ends_at) return '';
  const date = new Date(plat.promotion_ends_at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isNewDish(plat) {
  if (!plat?.created_at) return false;
  const createdAt = new Date(plat.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 3 * 24 * 60 * 60 * 1000;
}

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
const BILL_REQUEST_STORAGE_PREFIX = 'e-resto-bill-requested-';
const GROUP_ORDER_STORAGE_PREFIX = 'e-resto-group-order-';
const CART_DRAFT_STORAGE_PREFIX = 'e-resto-cart-draft-';
const EMAIL_PREFERENCES_STORAGE_KEY = 'e-resto-email-preferences';
const REMOTE_TABLE_NAME = 'Commandes en ligne';
let notificationAudioContext;
let notificationAudioUnlocked = false;

const dishSizeLabels = {
  small: 'Petit',
  medium: 'Moyen',
  large: 'Grand',
};

function isRemoteTableName(name) {
  const value = String(name || '').trim().toLowerCase();
  return value === REMOTE_TABLE_NAME.toLowerCase() || value === 'commandes hors restaurant';
}

function orderTableDisplay(order) {
  if (order?.order_type === 'remote' || isRemoteTableName(order?.table?.name)) {
    return 'WhatsApp';
  }

  return order?.table?.name || 'N/A';
}

function hasCompleteCongoPhone(value) {
  return String(value || '').replace(/\D/g, '').length >= 12;
}

function normalizeDishSizes(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function normalizeTextList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function DishSizes({ sizes, compact = false }) {
  const normalized = normalizeDishSizes(sizes);
  if (!normalized.length) return null;

  return (
    <div className={compact ? 'msizes compact' : 'msizes'}>
      {normalized.map((size) => (
        <span key={size}>{dishSizeLabels[size] || size}</span>
      ))}
    </div>
  );
}

function useTableId() {
  return useMemo(() => new URLSearchParams(window.location.search).get('table_id'), []);
}

function useOrderIdFromUrl() {
  return useMemo(() => new URLSearchParams(window.location.search).get('order_id'), []);
}

function useFeedbackRequestFromUrl() {
  return useMemo(() => new URLSearchParams(window.location.search).get('feedback') === '1', []);
}

function useRestaurantSlug() {
  return useMemo(() => new URLSearchParams(window.location.search).get('restaurant_slug'), []);
}

function useGroupSessionFromUrl() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get('group_code'),
      participant_id: params.get('group_participant_id'),
      participant_name: params.get('group_participant_name'),
      is_creator: params.get('group_creator') === '1',
    };
  }, []);
}

export function App() {
  const tableId = useTableId();
  const orderIdFromUrl = useOrderIdFromUrl();
  const feedbackRequestFromUrl = useFeedbackRequestFromUrl();
  const restaurantSlug = useRestaurantSlug();
  const groupSessionFromUrl = useGroupSessionFromUrl();
  const cart = useCart();
  const [menu, setMenu] = useState({ categories: [], plats: [] });
  const [scannedTable, setScannedTable] = useState(null);
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
  const [showSplash, setShowSplash] = useState(true);
  const [splashBrandLoaded, setSplashBrandLoaded] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [tableSession, setTableSession] = useState(null);
  const [tableSessionError, setTableSessionError] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [groupOrder, setGroupOrder] = useState(null);
  const [groupParticipant, setGroupParticipant] = useState(null);
  const [availableGroupOrder, setAvailableGroupOrder] = useState(null);
  const [groupJoinPrompt, setGroupJoinPrompt] = useState(null);
  const [brand, setBrand] = useState({
    name: 'Restaurant Scan',
    id: '',
    logo_url: '/img/logo/e-resto-logo.png',
    slogan: 'Fast Food & Restaurant',
    description: 'Fast Food & Restaurant',
    can_feedback: false,
    can_reservations: false,
    can_group_orders: false,
    can_mobile_money: false,
    can_chatbot: false,
    whatsapp_order_phone: '',
    payment_methods: ['cash'],
    theme: {
      primary: '#ff7a1a',
      secondary: '#d71920',
      background: '#fff7ef',
    },
  });
  const [emailPreferences, setEmailPreferences] = useState(() => readEmailPreferences(tableId, null));
  const [emailPreferencesOpen, setEmailPreferencesOpen] = useState(false);
  const [cancelledOrderModal, setCancelledOrderModal] = useState(null);
  const [cancelOrderRequest, setCancelOrderRequest] = useState(null);
  const creatingGroupOrderRef = useRef(false);
  const groupCartCount = useMemo(
    () => groupOrder?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ?? 0,
    [groupOrder?.items],
  );
  const visibleCartCount = groupParticipant ? groupCartCount : cart.totals.totalQuantity;
  const isTechnicalRemoteTable = isRemoteTableName(scannedTable?.name);
  const clientTableId = isTechnicalRemoteTable ? null : tableId;
  const hasRealTable = Boolean(clientTableId);

  const saveEmailPreferences = (preferences) => {
    writeEmailPreferences(preferences, tableId, brand);
    setEmailPreferences(preferences);
  };

  useEffect(() => {
    setEmailPreferences(readEmailPreferences(tableId, brand));
  }, [brand.id, brand.slug, tableId]);

  useEffect(() => {
    const prepare = () => prepareCustomerNotifications();

    window.addEventListener('click', prepare, { once: true });
    window.addEventListener('pointerdown', prepare, { once: true });
    window.addEventListener('touchstart', prepare, { once: true });
    window.addEventListener('keydown', prepare, { once: true });

    return () => {
      window.removeEventListener('click', prepare);
      window.removeEventListener('pointerdown', prepare);
      window.removeEventListener('touchstart', prepare);
      window.removeEventListener('keydown', prepare);
    };
  }, []);

  const menuParams = useMemo(
    () => (tableId ? { table_id: tableId } : (restaurantSlug ? { restaurant_slug: restaurantSlug } : {})),
    [restaurantSlug, tableId]
  );

  const loadPublicMenu = (silent = false) => {
    if (!silent) {
      setLoadingMenu(true);
      setShowSplash(true);
      setSplashBrandLoaded(false);
    }

    return getPublicMenu({ ...menuParams, _ts: Date.now() })
      .then((response) => {
        setMenu(response);
        setScannedTable(response.table || null);
        setMenuError('');
        if (response.table?.id && !isRemoteTableName(response.table?.name)) {
          createTableSession(response.table.id)
            .then((sessionResponse) => {
              setTableSession(sessionResponse.table_session || null);
              setTableSessionError('');
            })
            .catch((error) => {
              setTableSession(null);
              setTableSessionError(error.message || 'Impossible d activer la session de table.');
            });
        } else {
          setTableSession(null);
          setTableSessionError('');
        }
        if (response.restaurant) {
          const nextBrand = buildClientBrand(response.restaurant);
          setBrand(nextBrand);
          applyClientTheme(nextBrand);
        }
        setSplashBrandLoaded(true);
      })
      .catch((error) => {
        setMenuError(tableId
          ? (error.message || "Cette table n'est pas disponible pour commander.")
          : "Le menu backend n'est pas disponible pour le moment.");
        setMenu({ categories: [], plats: [] });
        setSplashBrandLoaded(true);
      })
      .finally(() => {
        if (!silent) {
          setLoadingMenu(false);
        }
      });
  };

  useEffect(() => {
    loadPublicMenu(false);
  }, [menuParams]);

  useEffect(() => {
    if (loadingMenu) return undefined;
    const timer = window.setTimeout(() => setShowSplash(false), 2000);
    return () => window.clearTimeout(timer);
  }, [loadingMenu]);

  useEffect(() => {
    const restaurantId = menu.restaurant_id || brand.id;
    if (!restaurantId) return undefined;

    return subscribeToMenuRealtime(restaurantId, {
      onUpdate: () => {
        loadPublicMenu(true);
      },
    });
  }, [menu.restaurant_id, brand.id, menuParams]);

  useEffect(() => {
    if (!clientTableId) return undefined;

    return subscribeToGroupOrderRealtime(clientTableId, {
      onGroupOrder: (payload) => {
        const nextGroupOrder = payload?.groupOrder || payload?.group_order;
        if (!nextGroupOrder?.code) return;

        if (creatingGroupOrderRef.current) return;
        if (nextGroupOrder.status === 'checked_out' && nextGroupOrder.order_id) {
          getOrder(nextGroupOrder.order_id)
            .then((order) => {
              clearStoredGroupOrder(tableId);
              clearGroupOrderUrl();
              setGroupOrder(null);
              setGroupParticipant(null);
              rememberActiveOrder(order, tableId, true);
              setActiveOrder(order);
              setOrderConfirmation(order);
              setActiveView('orders');
            })
            .catch(() => undefined);
          return;
        }

        if (groupParticipant?.id && groupOrder?.code === nextGroupOrder.code) {
          getGroupOrder(nextGroupOrder.code)
            .then((payload) => {
              if (payload.status !== 'open') return;
              setGroupOrder(payload);
              const nextParticipant = payload.participants?.find((item) => item.id === groupParticipant.id);
              if (nextParticipant) setGroupParticipant(nextParticipant);
            })
            .catch(() => undefined);
          return;
        }

        if (groupParticipant?.id || groupOrder?.code === nextGroupOrder.code) return;

        setAvailableGroupOrder(nextGroupOrder);
        if (payload?.action === 'created') {
          setGroupJoinPrompt(nextGroupOrder);
          playOrderNotificationSound('success');
        }
      },
    });
  }, [clientTableId, groupOrder?.code, groupParticipant?.id]);

  useEffect(() => {
    const tableOrderId = tableId ? localStorage.getItem(`${ACTIVE_ORDER_BY_TABLE_PREFIX}${tableId}`) : null;
    const urlTrackingCode = new URLSearchParams(window.location.search).get('tracking_code');
    const storedOrderId = orderIdFromUrl || tableOrderId || (!tableId ? localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY) : null);
    const storedTrackingCode = urlTrackingCode || (!tableId ? localStorage.getItem(ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY) : null);
    if (!storedOrderId && !storedTrackingCode) {
      if (tableId) {
        setRecoveryNotice('Entrez le code de suivi affiché après l\' envoi de votre commande pour la retrouver.');
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
        const restoredTableId = order?.table_id || order?.table?.id || null;
        const isExplicitUrlRecovery = Boolean(orderIdFromUrl || urlTrackingCode);
        const isRemoteOrder = order?.order_type === 'remote' || isRemoteTableName(order?.table?.name);

        if (!tableId && restoredTableId && !isRemoteOrder && !isExplicitUrlRecovery) {
          clearRememberedOrder();
          setRecoveryNotice('Entrez votre code de suivi pour retrouver uniquement votre commande.');
          return;
        }

        if (tableId && restoredTableId && String(restoredTableId) !== String(tableId)) {
          if (tableOrderId || orderIdFromUrl || urlTrackingCode) {
            clearRememberedOrder(tableId);
          }
          setRecoveryNotice('Aucune commande active trouvée pour cette table. Entrez votre code de suivi si besoin.');
          return;
        }

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
        } else {
          rememberActiveOrder(order, tableId, Boolean(orderIdFromUrl));
        }

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
            title: 'Suivi restauré',
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
    if (!tableId) return;
    const stored = groupSessionFromUrl.code && groupSessionFromUrl.participant_id
      ? groupSessionFromUrl
      : readStoredGroupOrder(tableId);
    if (!stored?.code || !stored?.participant_id) return;

    let cancelled = false;
    getGroupOrder(stored.code)
      .then((payload) => {
        if (cancelled || payload.status !== 'open') return;
        setGroupOrder(payload);
        const participant = payload.participants?.find((item) => item.id === stored.participant_id);
        setGroupParticipant(participant || {
          id: stored.participant_id,
          name: stored.participant_name || 'Client',
          is_creator: stored.is_creator === '1',
        });
      })
      .catch(() => clearStoredGroupOrder(tableId));

    return () => {
      cancelled = true;
    };
  }, [tableId, groupSessionFromUrl.code, groupSessionFromUrl.participant_id]);

  useEffect(() => {
    if (!tableId || groupParticipant) {
      setAvailableGroupOrder(null);
      return;
    }

    const stored = groupSessionFromUrl.code && groupSessionFromUrl.participant_id
      ? groupSessionFromUrl
      : readStoredGroupOrder(tableId);
    if (stored?.code && stored?.participant_id) return;

    let cancelled = false;
    getActiveGroupOrderByTable(tableId)
      .then((payload) => {
        if (cancelled) return;
        const activeGroup = payload.group_order || null;
        setAvailableGroupOrder(activeGroup);
        if (activeGroup?.code) {
          setGroupJoinPrompt(activeGroup);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableGroupOrder(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tableId, groupParticipant?.id, groupSessionFromUrl.code, groupSessionFromUrl.participant_id]);

  useEffect(() => {
    if (!groupOrder?.code || !groupParticipant?.id) return;
    const timer = window.setInterval(() => {
      heartbeatGroupOrderParticipant(groupOrder.code, groupParticipant.id)
        .then((payload) => {
          const nextGroupOrder = payload.group_order || payload;
          if (nextGroupOrder.status === 'open') {
            setGroupOrder(nextGroupOrder);
            const nextParticipant = nextGroupOrder.participants?.find((item) => item.id === groupParticipant.id);
            if (nextParticipant) setGroupParticipant(nextParticipant);
          }
        })
        .catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [groupOrder?.code, groupParticipant?.id]);

  const handleGroupOrderClick = async () => {
    if (!tableId) {
      setSnackbar({
        type: 'error',
        title: 'Table requise',
        message: 'La commande groupée est disponible uniquement après scan du QR code de table.',
      });
      return;
    }
    if (!tableSession?.token) {
      setSnackbar({
        type: 'error',
        title: 'Session de table',
        message: tableSessionError || 'Session de table non active. Veuillez scanner à nouveau le QR code.',
      });
      return;
    }

    if (groupOrder?.code && groupParticipant?.id) {
      setActiveView('cart');
      return;
    }

    try {
      const activeGroup = availableGroupOrder || (await getActiveGroupOrderByTable(tableId)).group_order;

      if (activeGroup?.code) {
        const name = window.prompt('Votre nom pour cette commande groupée.');
        if (!name?.trim()) return;

        const response = await joinGroupOrder(activeGroup.code, {
          name: name.trim(),
          email: emailPreferences?.enabled ? emailPreferences.email : undefined,
          email_receipt_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.receipt),
          email_feedback_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.feedback),
        });
        setGroupOrder(response.group_order);
        setGroupParticipant({ ...response.participant, is_creator: false });
        setAvailableGroupOrder(null);
        storeGroupOrder(tableId, response.group_order.code, response.participant, false);
        syncGroupOrderUrl(tableId, response.group_order.code, response.participant, false);
        setActiveView('cart');
        return;
      }

      const name = window.prompt('Votre nom pour créer la commande groupée.');
      if (!name?.trim()) return;

      creatingGroupOrderRef.current = true;
      const response = await createGroupOrder({
        table_id: tableId,
        table_session_token: tableSession.token,
        creator_name: name.trim(),
        creator_email: emailPreferences?.enabled ? emailPreferences.email : undefined,
        email_receipt_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.receipt),
        email_feedback_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.feedback),
      });
      setGroupOrder(response.group_order);
      setGroupParticipant({ ...response.creator_participant, is_creator: true });
      setAvailableGroupOrder(null);
      storeGroupOrder(tableId, response.group_order.code, response.creator_participant, true);
      syncGroupOrderUrl(tableId, response.group_order.code, response.creator_participant, true);
      setActiveView('cart');
    } catch (error) {
      setSnackbar({
        type: 'error',
        title: 'Commande groupée',
        message: error.message || 'Impossible de lancer la commande groupée.',
      });
    } finally {
      creatingGroupOrderRef.current = false;
    }
  };

  const joinAvailableGroupOrder = async (activeGroup, name) => {
    if (!activeGroup?.code || !name?.trim()) return;

    const response = await joinGroupOrder(activeGroup.code, {
      name: name.trim(),
      email: emailPreferences?.enabled ? emailPreferences.email : undefined,
      email_receipt_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.receipt),
      email_feedback_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.feedback),
    });
    setGroupOrder(response.group_order);
    setGroupParticipant({ ...response.participant, is_creator: false });
    setAvailableGroupOrder(null);
    setGroupJoinPrompt(null);
    storeGroupOrder(tableId, response.group_order.code, response.participant, false);
    syncGroupOrderUrl(tableId, response.group_order.code, response.participant, false);
    setActiveView('cart');
  };

  const addToGroupOrder = async (plat, quantity) => {
    if (!groupOrder?.code || !groupParticipant?.id) return;
    const existing = groupOrder.items?.find((item) => item.participant_id === groupParticipant.id && item.plat_id === plat.id);
    const nextQuantity = Number(existing?.quantity || 0) + Number(quantity || 1);
    const response = await upsertGroupOrderItem(groupOrder.code, {
      participant_id: groupParticipant.id,
      plat_id: plat.id,
      quantity: nextQuantity,
    });
    setGroupOrder(response.group_order);
    const nextParticipant = response.group_order?.participants?.find((item) => item.id === groupParticipant.id);
    if (nextParticipant) setGroupParticipant(nextParticipant);
    setActiveView('cart');
  };

  const updateGroupItemQuantity = async (item, quantity) => {
    if (!groupOrder?.code || !groupParticipant?.id || item.participant_id !== groupParticipant.id) return;
    const nextQuantity = Number(quantity);
    const response = nextQuantity <= 0
      ? await deleteGroupOrderItem(groupOrder.code, item.id)
      : await upsertGroupOrderItem(groupOrder.code, {
        participant_id: groupParticipant.id,
        plat_id: item.plat_id,
        quantity: nextQuantity,
      });
    setGroupOrder(response.group_order);
    const nextParticipant = response.group_order?.participants?.find((participant) => participant.id === groupParticipant.id);
    if (nextParticipant) setGroupParticipant(nextParticipant);
  };

  const toggleGroupParticipantReady = async (isReady) => {
    if (!groupOrder?.code || !groupParticipant?.id) return;
    try {
      const response = await setGroupOrderParticipantReady(groupOrder.code, groupParticipant.id, isReady, emailPreferences);
      setGroupOrder(response.group_order);
      setGroupParticipant(response.participant);
    } catch (error) {
      setSnackbar({
        type: 'error',
        title: 'Commande groupée',
        message: error.message || 'Impossible de modifier votre statut.',
      });
    }
  };

  const editGroupParticipantChoice = async () => {
    if (!groupOrder?.code || !groupParticipant?.id) return;

    if (groupParticipant.is_ready) {
      try {
        const response = await setGroupOrderParticipantReady(groupOrder.code, groupParticipant.id, false, emailPreferences);
        setGroupOrder(response.group_order);
        setGroupParticipant(response.participant);
      } catch (error) {
        setSnackbar({
          type: 'error',
          title: 'Commande groupée',
          message: error.message || 'Impossible de modifier votre choix.',
        });
        return;
      }
    }

    setActiveView('menu');
  };

  const clearMyGroupOrderItems = async () => {
    if (!groupOrder?.code || !groupParticipant?.id) return;
    const ownItems = groupOrder.items?.filter((item) => item.participant_id === groupParticipant.id) ?? [];
    if (!ownItems.length) return;

    try {
      let latestGroupOrder = groupOrder;
      for (const item of ownItems) {
        const response = await deleteGroupOrderItem(groupOrder.code, item.id);
        latestGroupOrder = response.group_order;
      }
      setGroupOrder(latestGroupOrder);
      const nextParticipant = latestGroupOrder?.participants?.find((participant) => participant.id === groupParticipant.id);
      if (nextParticipant) setGroupParticipant(nextParticipant);
      setSnackbar({
        type: 'success',
        title: 'Commande groupée',
        message: 'Vos plats ont été supprimés de la commande groupée.',
      });
    } catch (error) {
      setSnackbar({
        type: 'error',
        title: 'Commande groupée',
        message: error.message || 'Impossible de supprimer vos plats.',
      });
    }
  };

  const submitGroupOrder = async () => {
    if (!groupOrder?.code) return;
    const groupUsesTable = Boolean(groupOrder?.table?.id);
    if (groupUsesTable && !tableSession?.token) {
      setSnackbar({
        type: 'error',
        title: 'Session de table',
        message: tableSessionError || 'Session de table non active. Veuillez scanner à nouveau le QR code.',
      });
      return;
    }
    try {
      const response = await checkoutGroupOrder(groupOrder.code, {
        table_session_token: groupUsesTable ? tableSession?.token : undefined,
        customer_email: emailPreferences?.enabled ? emailPreferences.email : undefined,
        email_contact: emailPreferences?.enabled ? emailPreferences.email : undefined,
        email_receipt_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.receipt),
        email_feedback_opt_in: Boolean(emailPreferences?.enabled && emailPreferences.feedback),
      });
      clearStoredGroupOrder(tableId);
      clearGroupOrderUrl();
      setGroupOrder(null);
      setGroupParticipant(null);
      rememberActiveOrder(response.order, tableId, true);
      setActiveOrder(response.order);
      setOrderConfirmation(response.order);
      setActiveView('orders');
    } catch (error) {
      setSnackbar({
        type: 'error',
        title: 'Commande groupée',
        message: error.message || 'Impossible d envoyer la commande groupée.',
      });
    }
  };

  useEffect(() => {
    if (!brand.can_feedback || !activeOrder?.id || !canShowFeedbackForOrder(activeOrder)) return;
    const storageKey = `${FEEDBACK_STORAGE_PREFIX}${activeOrder.id}`;
    if (!feedbackRequestFromUrl && localStorage.getItem(storageKey)) return;

    let cancelled = false;
    const feedbackTimer = window.setTimeout(() => {
      getFeedbackAvailability(activeOrder.id)
        .then((availability) => {
          if (cancelled) return;

          if (availability.can_submit) {
            setFeedbackOrder(activeOrder);
            return;
          }

          localStorage.setItem(storageKey, availability.reason === 'already_submitted' ? 'sent' : 'unavailable');
          if (feedbackRequestFromUrl) {
            setSnackbar({
              type: 'info',
              title: availability.reason === 'already_submitted' ? 'Avis déjà envoyé' : availability.reason === 'expired' ? 'Lien avis expiré' : 'Avis indisponible',
              message: availability.reason === 'already_submitted'
                ? 'Merci pour votre avis. Vous pouvez consulter le menu du restaurant.'
                : availability.message || "L'avis n'est plus disponible pour cette commande.",
            });
            openRestaurantMenuFromFeedbackLink(activeOrder, tableId);
            setActiveView('menu');
          }
        })
        .catch((error) => {
          if (cancelled) return;
          if (feedbackRequestFromUrl) {
            setSnackbar({
              type: 'error',
              title: 'Avis indisponible',
              message: error.message || "Impossible de verifier l'avis.",
            });
            openRestaurantMenuFromFeedbackLink(activeOrder, tableId);
            setActiveView('menu');
          }
        });
    }, feedbackRequestFromUrl ? 0 : 600);

    return () => {
      cancelled = true;
      window.clearTimeout(feedbackTimer);
    };
  }, [brand.can_feedback, activeOrder?.id, activeOrder?.status, activeOrder?.order_type, feedbackRequestFromUrl]);

  const filteredPlats = menu.plats.filter((plat) => {
    const categoryId = plat.category?.id === undefined || plat.category?.id === null ? '' : String(plat.category.id);
    const matchesCategory = selectedCategory === 'all' || categoryId === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${plat.name} ${plat.description}`.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const openDetails = (plat) => setSelectedPlat(plat);

  return (
    <>
      {showSplash ? <SplashScreen brand={brand} ready={splashBrandLoaded} /> : null}
      <TopBar brand={brand} />
      <Navbar
        brand={brand}
        onSearch={() => setSearchOpen(true)}
        cartCount={visibleCartCount}
        activeView={activeView}
        activeOrder={activeOrder}
        scannedTable={isTechnicalRemoteTable ? null : scannedTable}
        hasTable={hasRealTable}
        onView={setActiveView}
      />
      <MobileBottomNav
        brand={brand}
        cartCount={visibleCartCount}
        activeView={activeView}
        activeOrder={activeOrder}
        hasTable={hasRealTable}
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
              scannedTable={isTechnicalRemoteTable ? null : scannedTable}
              tableId={clientTableId}
              categories={menu.categories}
              plats={filteredPlats}
              search={search}
              selectedCategory={selectedCategory}
              onSearch={setSearch}
              onCategory={setSelectedCategory}
              onDetails={openDetails}
              onGroupOrder={handleGroupOrderClick}
              groupOrder={groupOrder}
              groupParticipant={groupParticipant}
              availableGroupOrder={availableGroupOrder}
              canGroupOrders={brand.can_group_orders}
            />
          </div>
        )}
        {activeView === 'cart' && (
          <CartPage
            tableId={clientTableId}
            tableSession={tableSession}
            tableSessionError={tableSessionError}
            brand={brand}
            cart={cart}
            groupOrder={groupOrder}
            groupParticipant={groupParticipant}
            onGroupQuantity={updateGroupItemQuantity}
            onGroupReady={toggleGroupParticipantReady}
            onGroupEditChoice={editGroupParticipantChoice}
            onGroupClearMine={clearMyGroupOrderItems}
            onGroupSubmit={submitGroupOrder}
            onDetails={openDetails}
            emailPreferences={emailPreferences}
            onEmailPreferences={() => setEmailPreferencesOpen(true)}
            onOrderCreated={(order) => {
              rememberActiveOrder(order, tableId, true);
              setActiveOrder(order);
              setOrderConfirmation(order);
              setEditingOrder(null);
              setSnackbar({
                type: 'success',
                title: 'Commande envoyée',
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
                title: 'Commande modifiée',
                message: 'Votre modification a été envoyée au restaurant.',
              });
              setActiveView('orders');
            }}
            onContinueShopping={() => setActiveView('menu')}
          />
        )}
        {activeView === 'orders' && (
          <OrdersPage
            tableId={clientTableId}
            brand={brand}
            activeOrder={activeOrder}
            recoveryNotice={recoveryNotice}
            onRecovered={(order) => {
              setRecoveryNotice('');
              rememberActiveOrder(order, tableId, true);
              setActiveOrder(order);
              if (order.status === 'cancelled') {
                setCancelledOrderModal(order);
                playOrderNotificationSound('error');
                clearRememberedOrder(tableId);
                setSnackbar({
                  type: 'error',
                  title: 'Commande annulée',
                  message: getStatusNotificationMessage(order.status),
                });
                return;
              }
              setSnackbar({
                type: 'success',
                title: 'Commande retrouvée',
                message: 'Votre suivi de commande est de nouveau actif.',
              });
            }}
            onOrderUpdate={setActiveOrder}
            onStatusNotification={(notification) => setSnackbar(notification)}
            onCancellationModal={(order) => setCancelledOrderModal(order)}
            onCancelOrder={(order) => setCancelOrderRequest(order)}
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
        {activeView === 'reservations' && (
          <ReservationPage
            tableId={clientTableId}
            brand={brand}
            onStatus={(notification) => setSnackbar(notification)}
          />
        )}
      </main>
      <MenuModal plat={selectedPlat} onClose={() => setSelectedPlat(null)} onAdd={groupParticipant ? addToGroupOrder : cart.addItem} />
      <EmailPreferencesModal
        open={emailPreferencesOpen}
        preferences={emailPreferences}
        canFeedback={brand.can_feedback}
        onClose={() => setEmailPreferencesOpen(false)}
        onSave={async (preferences) => {
          saveEmailPreferences(preferences);
          setEmailPreferencesOpen(false);
          if (groupOrder?.code && groupParticipant?.id) {
            try {
              const response = await setGroupOrderParticipantReady(
                groupOrder.code,
                groupParticipant.id,
                Boolean(groupParticipant.is_ready),
                preferences,
              );
              setGroupOrder(response.group_order);
              setGroupParticipant(response.participant);
            } catch (error) {
              setSnackbar({
                type: 'error',
                title: 'Email',
                message: error.message || 'Impossible de sauvegarder votre choix email pour la commande groupée.',
              });
            }
          }
        }}
      />
      <GroupJoinPromptModal
        groupOrder={groupJoinPrompt}
        restaurantName={brand.name}
        onClose={() => setGroupJoinPrompt(null)}
        onJoin={(name) => joinAvailableGroupOrder(groupJoinPrompt, name).catch((error) => {
          setSnackbar({
            type: 'error',
            title: 'Commande groupée',
            message: error.message || 'Impossible de rejoindre la commande groupée.',
          });
        })}
      />
      <CancelledOrderModal order={cancelledOrderModal} onClose={() => setCancelledOrderModal(null)} />
      <CancelOrderReasonModal
        order={cancelOrderRequest}
        onClose={() => setCancelOrderRequest(null)}
        onConfirm={async (order, reason) => {
          const response = await cancelOrder(order.id, reason);
          setActiveOrder(response.order);
          setCancelledOrderModal(response.order);
          setCancelOrderRequest(null);
          playOrderNotificationSound('error');
          setSnackbar({
            type: 'success',
            title: 'Commande annulée',
            message: 'Votre commande a été annulée avant préparation.',
          });
        }}
        onError={(message) => setSnackbar({
          type: 'error',
          title: 'Annulation impossible',
          message,
        })}
      />
      <OrderConfirmationModal order={orderConfirmation} onClose={() => setOrderConfirmation(null)} onTrack={() => {
        setOrderConfirmation(null);
        setActiveView('orders');
      }} />
      <FeedbackModal
        order={brand.can_feedback ? feedbackOrder : null}
        restaurantName={brand.name}
        brand={brand}
        onClose={(submitted = false) => {
          if (feedbackOrder?.id) {
            localStorage.setItem(`${FEEDBACK_STORAGE_PREFIX}${feedbackOrder.id}`, submitted ? 'sent' : 'skipped');
          }
          setFeedbackOrder(null);
          if (submitted) {
            exitClientAppAfterFeedback();
          }
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

function SplashScreen({ brand, ready }) {
  const hasRestaurantLogo = Boolean(ready && brand?.has_restaurant_logo && brand?.logo_url);
  const defaultLogo = '/img/logo/e-resto-logo.png';
  const defaultSlogan = 'Scanner pour commander';
  const slogan = brand?.slogan || defaultSlogan;

  return (
    <div className="client-splash" style={{ background: brand?.theme?.background || 'var(--client-bg)' }}>
      <div className="client-splash-card">
        <div className="client-splash-logo">
          {ready ? (
            <img src={hasRestaurantLogo ? brand.logo_url : defaultLogo} alt={hasRestaurantLogo ? (brand?.name || 'Restaurant') : 'Restaurant Scan'} />
          ) : null}
        </div>
        <div className="client-splash-text">
          <strong>{ready ? (brand?.name || 'Restaurant') : 'Chargement'}</strong>
          <span>{ready ? slogan : 'Chargement du menu'}</span>
        </div>
        <div className="client-splash-loader" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>
    </div>
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

function Navbar({ brand, onSearch, cartCount, activeView, activeOrder, scannedTable, hasTable, onView }) {
  const navItems = [
    ['menu', 'Menu'],
    ['cart', 'Panier'],
    ...(!hasTable ? [['reservations', 'Reserver']] : []),
    ['orders', hasTable ? 'Commandes' : 'Suivi'],
  ];

  return (
    <nav className="navbar navbar-expand-lg" id="nav">
      <div className="container">
        <button className="navbar-brand clean-btn" type="button" onClick={() => onView('menu')}>
          <BrandLogo brand={brand} />
        </button>
        {scannedTable ? (
          <div className="mobile-table-pill">
            <i className="fas fa-location-dot"></i>
            <span>{scannedTable.name}</span>
          </div>
        ) : null}
        <div className="navbar-collapse desktop-nav" id="navmenu">
          <ul className="navbar-nav mx-auto">
            {navItems.map(([view, label]) => (
              <li className="nav-item" key={view}>
                <button
                  className={`nav-link clean-btn ${activeView === view ? 'active' : ''}`}
                  type="button"
                  onClick={() => onView(view)}
                >
                  {view === 'cart' ? (
                    <span className="cart-nav-link">
                      <i className="fas fa-shopping-cart"></i>
                      {label}
                      {cartCount > 0 ? <em>{cartCount}</em> : null}
                    </span>
                  ) : label}
                </button>
              </li>
            ))}
            {hasTable && activeOrder ? (
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

function MobileBottomNav({ brand, cartCount, activeView, activeOrder, hasTable, onView }) {
  const showReservationButton = !hasTable;
  const itemCountClass = hasTable ? 'three-items' : 'four-items';

  return (
    <nav className={`mobile-bottom-nav ${itemCountClass}`} aria-label="Navigation mobile">
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
      {showReservationButton ? (
        <button type="button" className={`mobile-bottom-item ${activeView === 'reservations' ? 'active' : ''}`} onClick={() => onView('reservations')}>
          <i className="fas fa-calendar-check"></i>
          <span>Reserver</span>
        </button>
      ) : null}
      <button
        type="button"
        className={`mobile-bottom-item ${activeView === 'orders' ? 'active' : ''} ${activeOrder ? 'has-order' : ''}`}
        onClick={() => onView('orders')}
      >
        <i className="fas fa-receipt"></i>
        <span>{hasTable ? 'Commandes' : 'Suivi'}</span>
      </button>
    </nav>
  );
}

function BrandLogo({ brand }) {
  return (
    <div className="blogo brand-logo">
      <img className="brand-logo-img" src={brand.logo_url || '/img/logo/e-resto-logo.png'} alt={brand.name || 'Restaurant Scan'} />
      <div>
        <div className="bname">{brand.name || 'Restaurant Scan'}</div>
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
          <button className="sovcat active clean-btn" onClick={() => onPickCategory('all')}><img src="/img/category/all.jfif" alt="" />All Items</button>
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
  const visible = categories;
  return (
    <section id="category">
      <div className="container">
        <SectionTitle eyebrow="What We Offer" title="Browse by" highlight="Category" description="From sizzling burgers to exotic world cuisines - find your favourite in our menu" />
        <div className="row g-3 justify-content-center">
          <CategoryCard category={{ id: 'all', name: 'All Items', plats_count: visible.reduce((sum, item) => sum + (item.plats_count || 0), 0) }} active={selectedCategory === 'all'} onSelect={onSelect} image="/img/category/all.jfif" />
          {visible.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              active={selectedCategory === String(category.id)}
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
      <button className={`catcard clean-btn ${active ? 'active' : ''}`} onClick={(event) => {
        event.currentTarget.blur();
        onSelect(String(category.id));
        document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
      }}>
        <img className="catimg" src={image} alt="" />
        <div className="catnm">{category.name}</div>
        <div className="catct">{category.plats_count ?? 0} items</div>
      </button>
    </div>
  );
}

function MenuSection({ loading, error, scannedTable, tableId, categories, plats, search, selectedCategory, onSearch, onCategory, onDetails, onGroupOrder, groupOrder, groupParticipant, availableGroupOrder, canGroupOrders }) {
  const tableLabel = scannedTable?.name || (tableId ? 'cette table' : '');
  const isRealTable = Boolean((scannedTable || tableId) && !isRemoteTableName(scannedTable?.name));
  const groupButtonText = groupParticipant
    ? `Commande groupée #${groupOrder?.code}`
    : availableGroupOrder
      ? 'Rejoindre la commande'
      : 'Créer une commande groupée';
  return (
    <section id="menu">
      <div className="container">
        <SectionTitle eyebrow="What's Cooking" title="Our Delicious" highlight="Menu" />
        {isRealTable ? (
          <div className="scanned-table-banner">
            <i className="fas fa-chair"></i>
            <span>Vous commandez depuis</span>
            <strong>{tableLabel}</strong>
            {canGroupOrders ? (
              <button type="button" className={`group-order-btn ${groupParticipant ? 'active' : ''}`} onClick={onGroupOrder}>
                <i className="fas fa-users"></i>
                {groupButtonText}
              </button>
            ) : null}
          </div>
        ) : null}
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
          <button className={`filtbtn ${selectedCategory === 'all' ? 'active' : ''}`} onClick={(event) => {
            event.currentTarget.blur();
            onCategory('all');
          }}>
            <img className="filtimg" src="/img/category/all.jfif" alt="" />
            <span>All</span>
          </button>
          {categories.map((category, index) => (
            <button className={`filtbtn ${selectedCategory === String(category.id) ? 'active' : ''}`} key={category.id} onClick={(event) => {
              event.currentTarget.blur();
              onCategory(String(category.id));
            }}>
              <img className="filtimg" src={assetUrl(category.image_url || category.image, fallbackCategoryImages[index % fallbackCategoryImages.length])} alt="" />
              <span>{category.name}</span>
            </button>
          ))}
        </div>
        {error && (
          <MenuStateCard
            icon="fa-circle-exclamation"
            title="Menu indisponible"
            message={error}
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
                image="/img/menu-attente.png"
                title="Menu en attente"
                message="La liste des plats n'est pas encore disponible. Essayez une autre catégorie ou revenez dans un instant."
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MenuStateCard({ icon, image, title, message, loading = false }) {
  return (
    <div className={`menu-state-card ${image ? 'with-image' : ''} ${loading ? 'loading' : ''}`}>
      {image ? (
        <img className="menu-state-image" src={image} alt="" />
      ) : (
        <div className="menu-state-icon">
          <i className={`fas ${icon}`}></i>
        </div>
      )}
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}

function MenuCard({ plat, index, onDetails }) {
  const image = assetUrl(plat.image_url || plat.image, fallbackMenuImages[index % fallbackMenuImages.length]);
  const promoActive = hasActivePromotion(plat);
  const newDish = isNewDish(plat);
  return (
    <div className="col-sm-6 col-lg-4 mwrap">
      <button className="mcard clean-btn" onClick={() => onDetails({ ...plat, image_url: image })}>
        <div className="mimg">
          <img src={image} alt={plat.name} />
          {newDish ? (
            <div className="mbdg new"><i className="fas fa-bolt"></i> Nouveau</div>
          ) : promoActive ? (
            <div className="mbdg promo"><i className="fas fa-tag"></i> -{plat.promotion_percent}%</div>
          ) : (
            <div className="mbdg hot"><i className="fas fa-star"></i> Hot</div>
          )}
          <div className="mhrt"><i className="far fa-heart"></i></div>
        </div>
        <div className="mbody">
          <div className="mcat">{plat.category?.name ?? 'Menu'}</div>
          <div className="mtit">{plat.name}</div>
          <div className="mdesc">{plat.description || 'Description non disponible.'}</div>
          <div className="mfoot">
            <div>
              <div className="mprice">
                {formatMoney(effectiveDishPrice(plat), plat.currency)}
                {promoActive ? <span className="old-price">{formatMoney(plat.price, plat.currency)}</span> : null}
              </div>
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
  const [activeImage, setActiveImage] = useState(0);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const images = [
    assetUrl(plat?.image_url || plat?.image, ''),
    assetUrl(plat?.image_secondaire_1_url || plat?.image_secondaire_1 || plat?.secondary_image_1 || plat?.image_2, ''),
    assetUrl(plat?.image_secondaire_2_url || plat?.image_secondaire_2 || plat?.secondary_image_2 || plat?.image_3, ''),
  ].filter(Boolean).filter((image, index, list) => list.indexOf(image) === index);

  useEffect(() => {
    setQuantity(1);
    setActiveImage(0);
    setImagePreviewOpen(false);
  }, [plat]);

  if (!plat) return null;

  const ingredients = normalizeTextList(plat.ingredients);
  const sizes = normalizeDishSizes(plat.sizes);
  const hasPreparationTime = plat.preparation_time !== null && plat.preparation_time !== undefined && plat.preparation_time !== '';
  const promoActive = hasActivePromotion(plat);
  const promoEnd = promotionEndLabel(plat);
  const previewImage = images[activeImage] || plat.image_url;

  return (
    <div id="menuPop" className="open" onClick={(event) => event.target.id === 'menuPop' && onClose()}>
      <div className="mpbox">
        <button className="mpclose" onClick={onClose}><i className="fas fa-times"></i></button>
        <div className="menu-detail-layout">
          <div className="menu-detail-media">
            {promoActive ? (
              <div className="menu-detail-promo-badge">
                <span>-{plat.promotion_percent}%</span>
                {promoEnd ? <small>Jusqu'au {promoEnd}</small> : null}
              </div>
            ) : null}
            <button
              type="button"
              className="clean-btn menu-detail-main-image"
              onClick={() => previewImage && setImagePreviewOpen(true)}
              aria-label="Voir l'image en grand"
            >
              <img id="mpImg" className="mpimg" src={previewImage} alt={plat.name} />
              <span><i className="fas fa-expand"></i></span>
            </button>
            <div className={`menu-detail-thumbs ${images.length <= 1 ? 'single' : ''}`}>
              {images.map((image, index) => (
                <button key={image} type="button" className={`clean-btn ${activeImage === index ? 'active' : ''}`} onClick={() => setActiveImage(index)} aria-label={`Image ${index + 1}`}>
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          </div>
          <div className="menu-detail-content">
            <div className="menu-detail-scroll">
              <div className="mcat" id="mpCat">{plat.category?.name ?? 'Menu'}</div>
              <div className="menu-detail-titlebar">
                <h3 id="mpTitle">{plat.name}</h3>
                <div className="mpqty">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><i className="fas fa-minus"></i></button>
                  <span id="mpQnum">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)}><i className="fas fa-plus"></i></button>
                </div>
              </div>
              <div className="menu-detail-price-row">
                <div className="mpprice" id="mpPrice">
                  {formatMoney(effectiveDishPrice(plat), plat.currency)}
                  {promoActive ? <span className="old-price">{formatMoney(plat.price, plat.currency)}</span> : null}
                </div>
                {sizes.length ? <DishSizes sizes={sizes} compact /> : null}
              </div>

              <div className="menu-detail-info">
                {hasPreparationTime ? (
                  <div className="menu-detail-row">
                    <span><i className="fas fa-clock"></i> Temps</span>
                    <strong>{plat.preparation_time} min</strong>
                  </div>
                ) : null}
                {plat.category?.name ? (
                  <div className="menu-detail-row">
                    <span><i className="fas fa-layer-group"></i> Categorie</span>
                    <strong>{plat.category.name}</strong>
                  </div>
                ) : null}
              </div>

              {ingredients.length ? (
                <div className="menu-detail-section">
                  <strong>Ingredients</strong>
                  <div id="mpTags">{ingredients.map((tag) => <span className="mptag" key={tag}>{tag}</span>)}</div>
                </div>
              ) : null}

              {plat.description ? (
                <div className="menu-detail-section">
                  <strong>Description</strong>
                  <p id="mpDesc">{plat.description}</p>
                </div>
              ) : null}

              <div className="menu-detail-actions">
                <button className="mpaddcart" id="mpAddCart" onClick={() => {
                  onAdd(plat, quantity);
                  onClose();
                }}><i className="fas fa-shopping-cart"></i>Ajouter au panier</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {imagePreviewOpen ? (
        <div className="dish-image-preview" role="dialog" aria-modal="true" aria-label={`Image de ${plat.name}`} onClick={() => setImagePreviewOpen(false)}>
          <button type="button" className="clean-btn dish-image-preview-close" onClick={() => setImagePreviewOpen(false)} aria-label="Fermer l'image">
            <i className="fas fa-times"></i>
          </button>
          <img src={previewImage} alt={plat.name} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
}

function ReservationPage({ tableId, brand, onStatus }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: '',
    phone: '+243',
    email: '',
    guests: '',
    reservation_date: today,
    reservation_time: '00:00',
    special_requests: '',
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const canSubmit = form.name.trim()
    && hasCompleteCongoPhone(form.phone)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    && Number(form.guests) > 0
    && form.reservation_date
    && form.reservation_time
    && (tableId || brand?.id || brand?.slug);

  const submitReservation = async (event) => {
    event.preventDefault();
    if (!canSubmit || sending) return;

    setSending(true);
    setMessage({ type: 'loading', text: 'Envoi de la demande de reservation...' });

    try {
      const response = await createReservation({
        table_id: tableId || undefined,
        restaurant_id: tableId ? undefined : brand?.id,
        restaurant_slug: tableId ? undefined : brand?.slug,
        ...form,
        guests: Number(form.guests),
      });

      setMessage({ type: 'success', text: response.message || 'Demande de réservation envoyée.' });
      onStatus?.({
        type: 'success',
        title: 'Réservation envoyée',
        message: 'Le restaurant va confirmer la disponibilité par email.',
      });
      setForm({
        name: '',
        phone: '+243',
        email: '',
        guests: 2,
        reservation_date: today,
        reservation_time: '19:00',
        special_requests: '',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Impossible d\' envoyer la réservation.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="app-page reservation-page-client">
      <div className="container">
        <div className="cart-panel-box">
          <div className="app-page-head">
            <span className="slbl">Reservation</span>
            <h2>Reserver une table</h2>
          </div>
          {!brand.can_reservations ? (
            <div className="client-alert error">Les Réservations ne sont pas activées pour ce restaurant.</div>
          ) : (
            <form className="mobile-money-form reservation-form" onSubmit={submitReservation}>
              <label className="reservation-field">
                <span>Nom complet</span>
                <input className="fctrl" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Votre nom" />
              </label>
              <label className="reservation-field">
                <span>Téléphone</span>
                <input className="fctrl" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+243..." />
              </label>
              <label className="reservation-field">
                <span>Email</span>
                <input className="fctrl" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="nom@email.com" />
              </label>
              <div className="reservation-form-grid">
                <label className="reservation-field">
                  <span>Personnes</span>
                  <input className="fctrl" type="number" min="1" max="50" value={form.guests} onChange={(event) => update('guests', event.target.value)} placeholder='Nombre de personnes' />
                </label>
                <label className="reservation-field">
                  <span>Date</span>
                  <input className="fctrl" type="date" min={today} value={form.reservation_date} onChange={(event) => update('reservation_date', event.target.value)} />
                </label>
                <label className="reservation-field">
                  <span>Heure</span>
                  <input className="fctrl" type="time" value={form.reservation_time} onChange={(event) => update('reservation_time', event.target.value)} />
                </label>
              </div>
              <label className="reservation-field">
                <span>Demande speciale</span>
                <textarea className="fctrl" rows="4" value={form.special_requests} onChange={(event) => update('special_requests', event.target.value)} placeholder="Ex: table calme, anniversaire, chaise enfant..." />
              </label>
              <button className="btn-red w-100 justify-content-center" type="submit" disabled={!canSubmit || sending}>
                <i className="fas fa-calendar-check"></i>{sending ? 'Envoi...' : 'Envoyer la réservation'}
              </button>
              {message.text ? <div className={`client-alert ${message.type}`}>{message.text}</div> : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function SwipeableCartLine({ children, onOpen, onDelete }) {
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef(null);
  const dragXRef = useRef(0);
  const movedRef = useRef(false);

  const startDrag = (clientX) => {
    startXRef.current = clientX;
    movedRef.current = false;
  };

  const moveDrag = (clientX) => {
    if (startXRef.current === null) return;
    const delta = clientX - startXRef.current;
    if (Math.abs(delta) > 8) movedRef.current = true;
    const nextDrag = Math.min(0, Math.max(delta, -96));
    dragXRef.current = nextDrag;
    setDragX(nextDrag);
  };

  const endDrag = () => {
    const shouldDelete = dragXRef.current <= -72;
    startXRef.current = null;
    dragXRef.current = 0;
    setDragX(0);
    window.setTimeout(() => {
      movedRef.current = false;
    }, 0);
    if (shouldDelete) onDelete?.();
  };

  const openLine = () => {
    if (!movedRef.current) onOpen?.();
  };

  return (
    <div className="swipe-cart-wrap">
      <div className="swipe-delete-action" aria-hidden="true">
        <i className="fas fa-trash"></i>
        <span>Supprimer</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        className="cart-line cart-line-clickable clean-btn"
        style={{ transform: `translateX(${dragX}px)` }}
        onClick={openLine}
        onPointerDown={(event) => startDrag(event.clientX)}
        onPointerMove={(event) => moveDrag(event.clientX)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen?.();
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onDelete?.();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

function restaurantCurrency(brand) {
  const currency = String(brand?.currency || 'CDF').toUpperCase();
  return ['CDF', 'USD'].includes(currency) ? currency : 'CDF';
}

function usdCdfRate(brand) {
  const settings = brand?.settings || {};
  const rate = Number(settings.usd_cdf_rate || settings.exchange_rate_usd_cdf || 2850);
  return rate > 0 ? rate : 2850;
}

function convertMoney(amount, fromCurrency, toCurrency, rate) {
  const from = String(fromCurrency || toCurrency).toUpperCase();
  const to = String(toCurrency || from).toUpperCase();
  const value = Number(amount || 0);

  if (from === to) return value;
  if (from === 'USD' && to === 'CDF') return value * rate;
  if (from === 'CDF' && to === 'USD') return value / rate;
  return value;
}

function cartConvertedTotals(cart, brand) {
  const currency = restaurantCurrency(brand);
  const rate = usdCdfRate(brand);
  const currencies = new Set();
  const totalAmount = cart.items.reduce((sum, item) => {
    const itemCurrency = String(item.plat?.currency || currency).toUpperCase();
    currencies.add(itemCurrency);
    return sum + convertMoney(effectiveDishPrice(item.plat), itemCurrency, currency, rate) * Number(item.quantity || 0);
  }, 0);

  return {
    currency,
    totalAmount,
    rate,
    hasMixedCurrencies: currencies.size > 1 || (currencies.size === 1 && !currencies.has(currency)),
  };
}

function CartPage({ tableId, tableSession, tableSessionError, brand, cart, groupOrder, groupParticipant, onGroupQuantity, onGroupReady, onGroupEditChoice, onGroupClearMine, onGroupSubmit, onOrderCreated, editingOrder, onOrderUpdated, onContinueShopping, onDetails, emailPreferences, onEmailPreferences }) {
  const [note, setNote] = useState(() => readCartDraft(tableId, brand).note || '');
  const [orderType, setOrderType] = useState(() => readCartDraft(tableId, brand).orderType || 'dine_in');
  const [customerName, setCustomerName] = useState(() => readCartDraft(tableId, brand).customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => readCartDraft(tableId, brand).customerPhone || (tableId ? '' : '+243'));
  const [customerAddress, setCustomerAddress] = useState(() => readCartDraft(tableId, brand).customerAddress || '');
  const [status, setStatus] = useState({ type: '', message: '' });
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!status.message) return undefined;
    const timer = window.setTimeout(() => setStatus({ type: '', message: '' }), 3500);
    return () => window.clearTimeout(timer);
  }, [status.message]);

  if (groupOrder && groupParticipant) {
    const ownItems = groupOrder.items?.filter((item) => item.participant_id === groupParticipant.id) ?? [];
    const participants = groupOrder.participants ?? [];
    const currentParticipant = participants.find((participant) => participant.id === groupParticipant.id) || groupParticipant;
    const waitingNames = groupOrder.readiness?.waiting_participants?.map((participant) => participant.name).filter(Boolean) ?? [];
    const canCheckoutGroup = Boolean(groupOrder.can_checkout);
    const handleGroupReadyClick = () => {
      if (currentParticipant.is_ready) {
        setStatus({ type: '', message: '' });
        onGroupEditChoice?.();
        return;
      }

      if (!ownItems.length) {
        setStatus({
          type: 'error',
          message: 'Ajoutez au moins un plat avant de terminer votre choix.',
        });
        return;
      }

      setStatus({ type: '', message: '' });
      onGroupReady?.(true);
    };

    return (
      <section className="cart-page app-page" id="cart-page">
        <div className="container">
          <div className="cart-panel-box">
            <div className="app-page-head">
              <span className="slbl">Commande groupée</span>
              <h2>Groupe #{groupOrder.code}</h2>
         
            </div>

            <div className="group-order-info">
              <strong>{currentParticipant.is_ready ? 'Vous avez terminé votre choix' : 'Vous participez à la commande'}</strong>
              <span>
                {canCheckoutGroup
                  ? 'Tous les participants actifs sont prêts. La commande peut être envoyée.'
                  : waitingNames.length
                    ? `En attente : ${waitingNames.join(', ')}`
                    : 'Chaque participant actif doit ajouter au moins un plat puis cliquer sur "J’ai terminé".'}
              </span>
            </div>

            {participants.map((participant) => {
              const items = groupOrder.items?.filter((item) => item.participant_id === participant.id) ?? [];
              return (
                <div className="group-participant-card" key={participant.id}>
                  <div className="group-participant-head">
                    <strong>{participant.name}</strong>
                    <span className={participant.is_active ? (participant.is_ready ? 'ready' : 'pending') : 'inactive'}>
                      {participant.is_active ? (participant.is_ready ? 'Prêt' : 'En cours') : 'Inactif'}
                    </span>
                  </div>
                  {items.length ? items.map((item) => {
                    const itemPlat = item.plat || {
                      id: item.plat_id,
                      name: item.name,
                      price: item.price,
                      currency: groupOrder.currency,
                      description: item.description,
                      image_url: item.image_url,
                      category: item.category,
                    };

                    return item.participant_id === groupParticipant.id ? (
                    <SwipeableCartLine
                      key={item.id}
                      onOpen={() => itemPlat?.id && onDetails?.(itemPlat)}
                      onDelete={() => onGroupQuantity(item, 0)}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>{formatMoney(item.price, groupOrder.currency)}</span>
                      </div>
                      <div className="mpqty small">
                        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                          event.stopPropagation();
                          onGroupQuantity(item, Number(item.quantity) - 1);
                        }}>-</button>
                        <span>{item.quantity}</span>
                        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                          event.stopPropagation();
                          onGroupQuantity(item, Number(item.quantity) + 1);
                        }}>+</button>
                      </div>
                    </SwipeableCartLine>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className="cart-line cart-line-clickable clean-btn"
                      key={item.id}
                      onClick={() => itemPlat?.id && onDetails?.(itemPlat)}
                      onKeyDown={(event) => {
                        if ((event.key === 'Enter' || event.key === ' ') && itemPlat?.id) {
                          event.preventDefault();
                          onDetails?.(itemPlat);
                        }
                      }}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>{formatMoney(item.price, groupOrder.currency)}</span>
                      </div>
                        <span className="group-item-qty">x{item.quantity}</span>
                    </div>
                  );
                  }) : (
                    <div className="group-empty-line">Aucun plat ajouté.</div>
                  )}
                </div>
              );
            })}

            {ownItems.length === 0 ? (
              <div className="client-alert info">Ajoutez vos plats depuis le menu.</div>
            ) : null}
            {status.message ? (
              <div className={`client-alert ${status.type || 'info'}`}>{status.message}</div>
            ) : null}

            <div className="cart-email-row">
              <div>
                <strong>{emailPreferenceLabel(emailPreferences)}</strong>
                <span>{emailPreferences?.enabled ? 'Envoi automatique après paiement confirmé.' : 'Optionnel'}</span>
              </div>
              <button
                type="button"
                className={`cart-email-switch clean-btn ${emailPreferences?.enabled ? 'active' : ''}`}
                onClick={onEmailPreferences}
                aria-label="Configurer le reçu et avis par email"
              >
                <span></span>
              </button>
            </div>

            <div className="group-ready-panel">
              {/* <div>
                <strong>{currentParticipant.is_ready ? 'Statut : prêt' : 'Statut : en cours'}</strong>
                <span>
                  {waitingNames.length
                    ? `En attente : ${waitingNames.join(', ')}`
                    : canCheckoutGroup ? 'Le groupe est prêt à envoyer.' : 'Ajoutez vos plats puis validez votre choix.'}
                </span>
              </div> */}
              <div className="group-action-buttons">
              <button
                type="button"
                className={`receipt-share-btn ${currentParticipant.is_ready ? 'active' : ''}`}
                onClick={handleGroupReadyClick}
              >
                <i className={currentParticipant.is_ready ? 'fas fa-pen' : 'fas fa-check'}></i>
                {currentParticipant.is_ready ? 'Modifier mon choix' : 'J’ai terminé'}
              </button>
              </div>
            </div>

            <div className="cart-total">
              <span>Total groupe</span>
              <strong>{formatMoney(groupOrder.total_amount, groupOrder.currency)}</strong>
            </div>

            <button className="btn-red cart-submit-btn w-100 justify-content-center" disabled={!canCheckoutGroup} onClick={onGroupSubmit}>
              <i className="fas fa-paper-plane"></i>Envoyer la commande groupée
            </button>
            {!canCheckoutGroup ? (
              <div className="client-alert info">L’envoi sera disponible quand tous les participants actifs auront ajouté un plat et terminé leur choix.</div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  const effectiveOrderType = tableId ? orderType : 'remote';
  const requiresTableSession = Boolean(tableId && effectiveOrderType !== 'remote');
  const hasValidTableSession = !requiresTableSession || Boolean(tableSession?.token);
  const whatsappOrderPhone = brand?.whatsapp_order_phone || brand?.owner_phone || '';
  const canSubmit = cart.items.length > 0
    && (tableId || brand?.id || brand?.slug)
    && hasValidTableSession
    && (effectiveOrderType !== 'remote' || (customerName.trim() && hasCompleteCongoPhone(customerPhone) && customerAddress.trim() && whatsappOrderPhone.trim()));
  const isEditing = Boolean(editingOrder?.id);
  const displayTotals = cartConvertedTotals(cart, brand);

  useEffect(() => {
    if (!tableId && !customerPhone.trim()) {
      setCustomerPhone('+243');
    }
  }, [customerPhone, tableId]);

  useEffect(() => {
    if (isEditing) return;
    writeCartDraft(tableId, brand, {
      note,
      orderType,
      customerName,
      customerPhone,
      customerAddress,
    });
  }, [brand?.id, brand?.slug, customerAddress, customerName, customerPhone, isEditing, note, orderType, tableId]);

  useEffect(() => {
    if (!editingOrder) return;
    setNote(editingOrder.note || '');
    setOrderType(editingOrder.order_type || 'dine_in');
    setCustomerName(editingOrder.customer_name || '');
    setCustomerPhone(editingOrder.customer_phone || '');
    setCustomerAddress('');
    setStatus({ type: 'info', message: 'Vous modifiez votre commande avant preparation.' });
  }, [editingOrder]);

  const submitOrder = async () => {
    if (!canSubmit || submittingRef.current) return;
    prepareCustomerNotifications();
    submittingRef.current = true;
    setStatus({ type: 'loading', message: isEditing ? 'Modification de la commande...' : 'Envoi de la commande...' });
    try {
      const payload = {
        table_id: tableId || undefined,
        restaurant_id: tableId ? undefined : brand?.id,
        restaurant_slug: tableId ? undefined : brand?.slug,
        order_type: effectiveOrderType,
        table_session_token: requiresTableSession ? tableSession?.token : undefined,
        note: effectiveOrderType === 'remote'
          ? [note, `Adresse client: ${customerAddress}`].filter(Boolean).join('\n')
          : note,
        payment_method: 'cash',
        payment_provider: null,
        wallet_id: null,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: emailPreferences?.enabled ? emailPreferences?.email : undefined,
        email_contact: emailPreferences?.enabled ? emailPreferences?.email : undefined,
        email_receipt_opt_in: Boolean(emailPreferences?.enabled && emailPreferences?.receipt),
        email_feedback_opt_in: Boolean(emailPreferences?.enabled && emailPreferences?.feedback),
        items: cart.items.map((item) => ({ plat_id: item.plat.id, quantity: item.quantity })),
      };
      const response = isEditing
        ? await updateOrderItems(editingOrder.id, payload)
        : await createOrder(payload);
      cart.clearCart();
      clearCartDraft(tableId, brand);
      setNote('');
      setOrderType('dine_in');
      setCustomerName('');
      setCustomerPhone(tableId ? '' : '+243');
      setCustomerAddress('');
      setStatus({
        type: response.order?.payment_status === 'failed' ? 'error' : 'success',
        message: response.order?.payment_status === 'failed'
          ? 'Commande envoyee, mais le paiement doit etre confirme au restaurant.'
          : isEditing ? 'Commande modifiee avec succes.' : (response.whatsapp_order_url ? 'Commande enregistree. WhatsApp va s ouvrir pour envoyer la commande au restaurant.' : 'Commande envoyee avec succes.')
      });
      if (response.whatsapp_order_url) {
        window.open(response.whatsapp_order_url, '_blank', 'noopener,noreferrer');
      }
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
          {/* <button type="button" className="receipt-share-btn" onClick={onContinueShopping}>
            <i className="fas fa-utensils"></i>
            Menu
          </button> */}
        </div>
        {isEditing && (
          <div className="client-alert info">
            Modification autorisée tant que la commande n'est pas en préparation et pas déjà payée.
            <button type="button" className="receipt-share-btn mt-2" onClick={onContinueShopping}>
              <i className="fas fa-plus"></i>
              Ajouter d'autres plats
            </button>
          </div>
        )}
        {cart.items.length === 0 ? (
          <div className="empty-page-card compact">
            <i className="fas fa-shopping-cart"></i>
            <strong>Votre panier est vide</strong>
            <span>Ajoutez un plat depuis le menu pour commencer.</span>
          </div>
        ) : cart.items.map((item) => (
          <SwipeableCartLine
            key={item.plat.id}
            onOpen={() => onDetails?.(item.plat)}
            onDelete={() => cart.removeItem(item.plat.id)}
          >
            <div>
              <strong>{item.plat.name}</strong>
              <span>{formatMoney(effectiveDishPrice(item.plat), item.plat.currency)}</span>
            </div>
            <div className="mpqty small">
              <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                event.stopPropagation();
                cart.updateQuantity(item.plat.id, item.quantity - 1);
              }}>-</button>
              <span>{item.quantity}</span>
              <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                event.stopPropagation();
                cart.updateQuantity(item.plat.id, item.quantity + 1);
              }}>+</button>
            </div>
          </SwipeableCartLine>
        ))}
        {cart.items.length > 0 && (
          <>
            <textarea className="fctrl" rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ajouter une note..." />
            <div className="cart-email-row">
              <div>
                <strong>{emailPreferenceLabel(emailPreferences)}</strong>
                <span>{emailPreferences?.enabled ? 'Envoi automatique après paiement confirmé.' : 'Optionnel'}</span>
              </div>
              <button
                type="button"
                className={`cart-email-switch clean-btn ${emailPreferences?.enabled ? 'active' : ''}`}
                onClick={onEmailPreferences}
                aria-label="Configurer le reçu et avis par email"
              >
                <span></span>
              </button>
            </div>
            {tableId ? (
              <div className="order-type-box">
                <div className="payment-title">
                  <strong>Mode de service</strong>
                  <span>Choisissez comment le restaurant doit traiter la commande.</span>
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
              </div>
            ) : null}
            {!tableId && !whatsappOrderPhone ? (
              <div className="client-alert error">
                Le restaurant doit configurer un numéro WhatsApp pour recevoir les commandes en ligne.
              </div>
            ) : null}
            {requiresTableSession && !hasValidTableSession ? (
              <div className="client-alert error">
                {tableSessionError || 'Session de table non active. Veuillez scanner à nouveau le QR code.'}
              </div>
            ) : null}
            {!tableId && (
              <div className="mobile-money-form">
                <label>Nom du client</label>
                <input className="fctrl" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Votre nom" />
                <label>Téléphone</label>
                <input className="fctrl" type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+243 8XX XXX XXX" />
                <label>Adresse</label>
                <input className="fctrl" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} placeholder="Avenue, quartier, commune..." />
              </div>
            )}
            <div className="cart-total">
              <span>Total</span>
              <strong>{formatMoney(displayTotals.totalAmount, displayTotals.currency)}</strong>
            </div>
            {displayTotals.hasMixedCurrencies ? (
              <div className="payment-note success">
                Les plats en devise differente sont convertis vers {displayTotals.currency} avec le taux 1 USD = {displayTotals.rate} CDF.
              </div>
            ) : null}
            <button className="btn-red cart-submit-btn w-100 justify-content-center" disabled={!canSubmit || status.type === 'loading'} onClick={submitOrder}>
              <i className="fas fa-paper-plane"></i>{isEditing ? 'Enregistrer la modification' : (!tableId ? 'Envoyer et ouvrir WhatsApp' : 'Envoyer la commande')}
            </button>
          </>
        )}
        {status.message && <div className={`client-alert ${status.type}`}>{status.message}</div>}
      </div>
      </div>
    </section>
  );
}

function OrderConfirmationModal({ order, onClose, onTrack }) {
  if (!order) return null;

  const code = order.tracking_code ?? String(order.id).slice(0, 8).toUpperCase();

  return (
    <div className="order-confirmation-backdrop" role="dialog" aria-modal="true" aria-label="Commande envoyée">
      <div className="order-confirmation-modal">
        <button type="button" className="clean-btn order-confirmation-close" onClick={onClose} aria-label="Fermer">
          <i className="fas fa-times"></i>
        </button>
        <div className="order-confirmation-icon">
          <i className="fas fa-circle-check"></i>
        </div>
        <span className="slbl">Commande envoyée</span>
        <h2>Votre commande est bien partie</h2>
        <p>Gardez ce code pour retrouver le suivi si vous fermez l'application.</p>
        <div className="order-confirmation-code">
          <small>Code de suivi</small>
          <strong>{code}</strong>
        </div>
        <div className="order-confirmation-actions">
          <button type="button" className="btn-red order-confirmation-dismiss" onClick={onClose}>
            <i className="fas fa-xmark"></i>
            Fermer
          </button>
          <button type="button" className="btn-red" onClick={onTrack}>
            <i className="fas fa-location-dot"></i>
            Voir le suivi
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupJoinPromptModal({ groupOrder, restaurantName, onClose, onJoin }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (groupOrder?.code) {
      setName('');
      setSubmitting(false);
    }
  }, [groupOrder?.code]);

  if (!groupOrder) return null;

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onJoin(name.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="order-modal-backdrop">
      <div className="group-join-modal">
        <button type="button" className="clean-btn cancel-modal-close" onClick={onClose} aria-label="Fermer">
          <i className="fas fa-times"></i>
        </button>
        <div className="group-join-icon">
          <i className="fas fa-users"></i>
        </div>
        <span className="slbl">Commande groupée</span>
        <h2>Une commande groupée est ouverte</h2>
        <p>
          Un client vient de créer une commande groupée pour cette table.
          Voulez-vous la rejoindre ?
        </p>
        <label>
          Votre nom
          <input
            className="fctrl"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ex: Hena"
            autoFocus
          />
        </label>
        <div className="group-join-actions">
          <button type="button" className="receipt-share-btn" onClick={onClose} disabled={submitting}>
            Plus tard
          </button>
          <button type="button" className="btn-red" onClick={submit} disabled={!name.trim() || submitting}>
            <i className="fas fa-user-plus"></i>
            {submitting ? 'Connexion...' : 'Rejoindre'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailPreferencesModal({ open, preferences, canFeedback, onClose, onSave }) {
  const [form, setForm] = useState(preferences || readEmailPreferences());

  useEffect(() => {
    if (open) {
      setForm(preferences || readEmailPreferences());
    }
  }, [open, preferences]);

  if (!open) return null;

  const enabled = Boolean(form.receipt || form.feedback);
  const save = () => {
    const email = String(form.email || '').trim();
    if (enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.alert('Entrez une adresse email valide.');
      return;
    }

    onSave({
      enabled,
      receipt: Boolean(form.receipt),
      feedback: Boolean(form.feedback && canFeedback),
      email,
    });
  };

  return (
    <div className="order-modal-backdrop">
      <div className="email-preferences-modal">
        <button type="button" className="clean-btn cancel-modal-close" onClick={onClose} aria-label="Fermer">
          <i className="fas fa-times"></i>
        </button>
        <div className="email-pref-icon"><i className="fas fa-envelope"></i></div>
        <h2>Recevoir par email</h2>
        <p>Choisissez ce que vous voulez recevoir après confirmation du paiement.</p>

        <label className="email-pref-option">
          <input
            type="checkbox"
            checked={Boolean(form.receipt)}
            onChange={(event) => setForm((current) => ({ ...current, receipt: event.target.checked }))}
          />
          <span>
            <strong>Envoyer le reçu PDF par email</strong>
            <small>Le reçu sera envoyé en pièce jointe quand la commande sera payée.</small>
          </span>
        </label>

        <label className={`email-pref-option ${!canFeedback ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            disabled={!canFeedback}
            checked={Boolean(form.feedback && canFeedback)}
            onChange={(event) => setForm((current) => ({ ...current, feedback: event.target.checked }))}
          />
          <span>
            <strong>Recevoir le lien pour donner mon avis sur le plat</strong>
            <small>{canFeedback ? 'Un lien sera préparé avec le code de suivi.' : 'Les avis ne sont pas activés pour ce restaurant.'}</small>
          </span>
        </label>

        <label className="email-pref-address">
          Adresse email
          <input
            className="fctrl"
            type="email"
            value={form.email || ''}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="client@email.com"
          />
        </label>

        <div className="email-pref-actions">
          <button type="button" className="receipt-share-btn" onClick={onClose}>Fermer</button>
          <button type="button" className="btn-red" onClick={save}>
            <i className="fas fa-check"></i>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

const orderSteps = [
  { key: 'pending', label: 'Commande reçue', icon: 'fa-receipt', description: 'Votre commande est bien arrivée en cuisine.' },
  { key: 'preparing', label: 'En préparation', icon: 'fa-fire-burner', description: 'Notre équipe prépare vos plats.' },
  { key: 'ready', label: 'Prête', icon: 'fa-bell', description: 'Votre commande est prête à être servie.' },
  { key: 'delivered', label: 'Servie', icon: 'fa-utensils', description: 'Bon appétit, votre commande est servie.' },
];

const statusLabels = {
  pending: 'Commande reçue',
  preparing: 'En préparation',
  ready: 'Prête',
  delivered: 'Servie',
  cancelled: 'Annulée',
};

const paymentStatusLabels = {
  unpaid: 'Paiement non confirmé',
  pending: 'Paiement en attente',
  paid: 'Paiement confirmé',
  failed: 'Paiement échoué',
  refunded: 'Paiement remboursé',
};

function OrdersPage({
  tableId,
  brand,
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
      {/* <div className="container">
        <div className="app-page-head">
          <h2>Suivi de commande</h2>
        </div>
      </div> */}
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
            <span>Votre suivi apparaitra ici après l'envoi du panier.</span>
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

  if (tableId) {
    localStorage.setItem(`${ACTIVE_ORDER_BY_TABLE_PREFIX}${tableId}`, order.id);
  } else {
    localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, order.id);
    localStorage.setItem(ACTIVE_ORDER_STATUS_STORAGE_KEY, order.status);
    if (order.tracking_code) {
      localStorage.setItem(ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY, order.tracking_code);
    }
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
  if (tableId) {
    localStorage.removeItem(`${ACTIVE_ORDER_BY_TABLE_PREFIX}${tableId}`);
  } else {
    localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_ORDER_STATUS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_ORDER_TRACKING_CODE_STORAGE_KEY);
  }

  const url = new URL(window.location.href);
  if (url.searchParams.has('order_id')) {
    url.searchParams.delete('order_id');
    url.searchParams.delete('tracking_code');
    window.history.replaceState({}, '', url.toString());
  }
}

function storeGroupOrder(tableId, code, participant, isCreator) {
  if (!tableId || !code || !participant?.id) return;
  localStorage.setItem(`${GROUP_ORDER_STORAGE_PREFIX}${tableId}`, JSON.stringify({
    code,
    participant_id: participant.id,
    participant_name: participant.name,
    is_creator: isCreator ? '1' : '0',
  }));
}

function syncGroupOrderUrl(tableId, code, participant, isCreator) {
  if (!code || !participant?.id) return;
  const url = new URL(window.location.href);
  if (tableId) {
    url.searchParams.set('table_id', tableId);
  }
  url.searchParams.set('group_code', code);
  url.searchParams.set('group_participant_id', participant.id);
  url.searchParams.set('group_participant_name', participant.name || '');
  url.searchParams.set('group_creator', isCreator ? '1' : '0');
  window.history.replaceState({}, '', url.toString());
}

function clearGroupOrderUrl() {
  const url = new URL(window.location.href);
  ['group_code', 'group_participant_id', 'group_participant_name', 'group_creator'].forEach((key) => {
    url.searchParams.delete(key);
  });
  window.history.replaceState({}, '', url.toString());
}

function readStoredGroupOrder(tableId) {
  if (!tableId) return null;
  try {
    return JSON.parse(localStorage.getItem(`${GROUP_ORDER_STORAGE_PREFIX}${tableId}`) || 'null');
  } catch {
    return null;
  }
}

function clearStoredGroupOrder(tableId) {
  if (tableId) {
    localStorage.removeItem(`${GROUP_ORDER_STORAGE_PREFIX}${tableId}`);
  }
}

function cartDraftKey(tableId, brand) {
  return `${CART_DRAFT_STORAGE_PREFIX}${tableId || brand?.slug || brand?.id || 'default'}`;
}

function readCartDraft(tableId, brand) {
  try {
    return JSON.parse(localStorage.getItem(cartDraftKey(tableId, brand)) || 'null') || {};
  } catch {
    return {};
  }
}

function writeCartDraft(tableId, brand, draft) {
  localStorage.setItem(cartDraftKey(tableId, brand), JSON.stringify(draft));
}

function clearCartDraft(tableId, brand) {
  localStorage.removeItem(cartDraftKey(tableId, brand));
}

function emailPreferencesKey(tableId, brand) {
  return `${EMAIL_PREFERENCES_STORAGE_KEY}-${tableId || brand?.slug || brand?.id || 'default'}`;
}

function defaultEmailPreferences() {
  return {
    enabled: false,
    receipt: false,
    feedback: false,
    email: '',
  };
}

function readEmailPreferences(tableId, brand) {
  try {
    return JSON.parse(localStorage.getItem(emailPreferencesKey(tableId, brand)) || 'null') || defaultEmailPreferences();
  } catch {
    return defaultEmailPreferences();
  }
}

function writeEmailPreferences(preferences, tableId, brand) {
  localStorage.setItem(emailPreferencesKey(tableId, brand), JSON.stringify(preferences));
}

function emailPreferenceLabel(preferences) {
  if (!preferences?.enabled) return 'Envoyez reçu par email';
  const labels = [];
  if (preferences.receipt) labels.push('Reçu');
  if (preferences.feedback) labels.push('avis');
  return labels.length ? `${labels.join(' et ')} par email` : 'Envoyez reçu par email';
}

function OrderRecoverySection({ tableId, activeOrder, notice, onRecovered }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });

  if (activeOrder) return null;

  const recover = async (event) => {
    event.preventDefault();
    if (!code.trim()) {
      setStatus({ type: 'error', message: 'Entrez votre code de suivi.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Recherche de votre commande...' });
    try {
      const order = await trackOrder({
        code: code.trim(),
        table_id: tableId || undefined,
      });
      setCode('');
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
            <p>{notice || 'Entrez votre code de suivi pour retrouver votre commande et voir son statut.'}</p>
          </div>
          <div className="order-recovery-fields">
            <input className="fctrl" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Code ex: A7K92B" />
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
  const [, setConnectionState] = useState(order ? 'Connexion au suivi...' : '');
  const [cancelling, setCancelling] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billRequestedLocally, setBillRequestedLocally] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(() => notificationAudioUnlocked || getNotificationPermission() === 'granted');
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

    const applyOrderUpdate = (nextOrder) => {
      orderRef.current = nextOrder;
      onOrderUpdate(nextOrder);
    };

    const unsubscribeRealtime = subscribeToOrderRealtime(order.id, {
      onOrder: applyOrderUpdate,
      onState: setConnectionState,
    });

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
      unsubscribeRealtime();
    };
  }, [order?.id, onOrderUpdate]);

  useEffect(() => {
    if (!order?.id) return;

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
      playOrderNotificationSound(notification.type);
      notifyBrowser(title, message);
      if (order.status === 'cancelled') {
        onCancellationModal?.(order);
      }
      document.getElementById('order-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    lastStatusRef.current = order.status;

    if (order.status === 'cancelled' || order.status === 'delivered') {
      clearRememberedOrder(tableId);
    } else {
      rememberActiveOrder(order, tableId);
    }
  }, [order?.id, order?.status, order?.payment_status, tableId, onStatusNotification]);

  useEffect(() => {
    if (!order?.id) {
      setBillRequestedLocally(false);
      return;
    }

    const key = `${BILL_REQUEST_STORAGE_PREFIX}${order.id}`;
    const serverRequested = Boolean(order.latest_payment?.metadata?.bill_requested);

    if (serverRequested) {
      localStorage.setItem(key, 'true');
    }

    setBillRequestedLocally(serverRequested || localStorage.getItem(key) === 'true');
  }, [order?.id, order?.latest_payment?.metadata?.bill_requested]);

  if (!order) return null;

  const currentIndex = orderSteps.findIndex((step) => step.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const visibleOrderSteps = isCancelled
    ? [...orderSteps.slice(0, 1), { key: 'cancelled', label: 'Annulée', icon: 'fa-ban' }]
    : orderSteps;
  const canClientCancel = order.status === 'pending' && order.payment_status !== 'paid';
  const canClientEdit = order.status === 'pending' && order.payment_status !== 'paid';
  const billAlreadyRequested = Boolean(order.latest_payment?.metadata?.bill_requested) || billRequestedLocally;
  const canRequestBill = order.payment_method === 'cash'
    && order.payment_status !== 'paid'
    && order.order_type !== 'remote'
    && order.status === 'delivered';

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
      title: 'Alertes activées',
      message: 'Vous recevrez un son quand le statut de votre commande change.',
    });
  };

  const handleRequestBill = async () => {
    if (!canRequestBill || requestingBill || billAlreadyRequested) return;
    const key = `${BILL_REQUEST_STORAGE_PREFIX}${order.id}`;
    setRequestingBill(true);
    setBillRequestedLocally(true);
    localStorage.setItem(key, 'true');
    try {
      const response = await requestBill(order.id);
      onOrderUpdate(response.order);
      onStatusNotification({
        type: 'success',
        title: 'Addition demandée',
        message: 'Le restaurant a reçu votre demande d\' addition.',
      });
      playOrderNotificationSound('success');
    } catch (error) {
      setBillRequestedLocally(false);
      localStorage.removeItem(key);
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
    const trackingCode = order.tracking_code ?? String(order.id).slice(0, 8).toUpperCase();
    const text = `Code de suivi : ${trackingCode}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    navigator.clipboard?.writeText(text).catch(() => undefined);

    onStatusNotification({
      type: 'success',
      title: 'Code copié',
      message: 'Le code de suivi a été copié et WhatsApp va s ouvrir.',
    });
  };

  return (
    <section id="order-tracking" className="order-tracking-section">
      <div className="container">
        <div className={`order-tracker ${isCancelled ? 'cancelled' : ''}`}>
          <div className="order-progress-panel">
            <div className="order-tracker-head">
              <div>
                <span className="slbl">Suivi en temps réel</span>
                <h2>Commande #{String(order.id).slice(0, 8).toUpperCase()}</h2>
              </div>
            </div>

            <div className="order-steps">
              {visibleOrderSteps.map((step, index) => {
                const done = isCancelled ? index <= 1 : currentIndex >= index;
                const current = isCancelled ? step.key === 'cancelled' : currentIndex === index;
                return (
                  <div className={`order-step order-status-${step.key} ${done ? 'done' : ''} ${current ? 'current' : ''} ${step.key === 'cancelled' ? 'cancelled' : ''}`} key={step.key}>
                    <div className="order-step-icon"><i className={`fas ${step.icon}`}></i></div>
                    <strong>{step.label}</strong>
                  </div>
                );
              })}
            </div>
          </div>
{/* 
          {isCancelled && order.cancellation_reason && (
            <div className="client-alert error">
              Motif d'annulation : {order.cancellation_reason}
            </div>
          )} */}

          {!alertsEnabled && (
            <div className="order-alerts-box">
              <div>
                <strong>Alertes commande</strong>
                <span>Activez le son et les notifications pour être prevenu si le statut change.</span>
              </div>
              <button type="button" className="order-alert-button clean-btn" onClick={handleEnableAlerts}>
                <i className="fas fa-volume-high"></i>
                Activer
              </button>
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
              <small>Paiement</small>
              <strong>{paymentStatusLabels[order.payment_status] ?? order.payment_status ?? 'Non confirme'}</strong>
            </div>
            <div>
              <small>Service</small>
              <strong>{order.order_type === 'remote' ? 'En ligne' : order.order_type === 'takeaway' ? 'A emporter' : 'Sur place'}</strong>
            </div>
          </div>

          <div className="order-tracking-share no-print">
            <span>Gardez ce code pour revenir voir le statut si vous fermez la page.</span>
            <button className="receipt-share-btn" type="button" onClick={shareTracking}>
              <i className="fas fa-share-nodes"></i>
              Partager le code
            </button>
          </div>

          {canClientCancel && (
            <div className="order-bottom-actions no-print">
              <button className="btn-red" type="button" onClick={() => onEditOrder?.(order)}>
                <i className="fas fa-pen-to-square"></i>
                Modifier
              </button>
              <button className="receipt-download-btn" type="button" disabled={cancelling} onClick={handleCancel}>
                <i className="fas fa-ban"></i>
                {cancelling ? 'Annulation...' : 'Annuler'}
              </button>
            </div>
          )}

          {canRequestBill && (
            <div className="d-flex flex-wrap gap-2 no-print">
              <button className="receipt-share-btn" type="button" disabled={requestingBill || billAlreadyRequested} onClick={handleRequestBill}>
                <i className="fas fa-receipt"></i>
                {billAlreadyRequested ? 'Addition déjà demandée' : requestingBill ? 'Demande...' : "Demander l'addition"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReceiptSection({ order, brand }) {
  const [pdfPreview, setPdfPreview] = useState(null);

  useEffect(() => {
    if (order?.payment_status !== 'paid') return undefined;

    const { doc, filename } = buildReceiptPdf(order, brand);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfPreview({ url, filename });

    return () => URL.revokeObjectURL(url);
  }, [order?.id, order?.payment_status]);

  if (order?.payment_status !== 'paid') return null;

  const receiptNumber = `ER-${String(order.id).slice(0, 8).toUpperCase()}`;
  const placedAt = order.created_at ? new Date(order.created_at) : new Date();
  const items = order.items ?? [];
  const paymentMethod = getPaymentMethodLabel(order);
  const tableDisplay = orderTableDisplay(order);

  const generatePdf = () => buildReceiptPdf(order, brand);

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
      `Table: ${tableDisplay}`,
      `Date: ${placedAt.toLocaleString('fr-FR')}`,
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
      `Merci pour votre visite chez ${brand?.name || 'Restaurant Scan'}.`,
    ];

    const text = lines.join('\n');

    if (navigator.share) {
      await navigator.share({
        title: `Recu ${brand?.name || 'Restaurant Scan'} ${receiptNumber}`,
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
              <i className="fas fa-download"></i>TÃ©lÃ©charger
            </button>
            <button className="receipt-share-btn" onClick={shareReceipt}>
              <i className="fas fa-share-nodes"></i>Partager au client
            </button>
          </div>

          <div className="receipt-card" id="paid-receipt">
            <div className="receipt-top">
              <div className="receipt-brand">
                <img src={brand?.logo_url || '/img/logo/e-resto-logo.png'} alt={brand?.name || 'Restaurant Scan'} />
                <div>
                  <strong>{brand?.name || 'Restaurant Scan'}</strong>
                  <span>{brand?.slogan || brand?.description || 'Fast Food & Restaurant'}</span>
                </div>
              </div>
              <div className="receipt-paid">
                <i className="fas fa-circle-check"></i>
                Payee
              </div>
            </div>

            <div className="receipt-title">
              <span>Reçu de paiement</span>
              <h2>{receiptNumber}</h2>
              <p>Merci pour votre commande. Voici le recapitulatif complet.</p>
            </div>

            <div className="receipt-meta">
              <div>
                <small>Table</small>
                <strong>{tableDisplay}</strong>
              </div>
              <div>
                <small>Date</small>
                <strong>{placedAt.toLocaleDateString('fr-FR')}</strong>
              </div>
              <div>
                <small>Heure</small>
                <strong>{placedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
              <div>
                <small>Paiement</small>
                <strong>{paymentMethod}</strong>
              </div>
            </div>

            <div className="receipt-items">
              <div className="receipt-row receipt-head">
                <span>Article</span>
                <span>QtÃ©</span>
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
              <span>Total payé</span>
              <strong>{formatMoney(order.total_amount, order.currency)}</strong>
            </div>

            <div className="receipt-footer">
              <p>Nous esperons vous revoir bientot chez {brand?.name || 'Restaurant Scan'}.</p>
              <span>Reçu généré automatiquement par Restaurant Scan</span>
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
            <iframe src={pdfPreview.url} title="Reçu PDF Restaurant Scan"></iframe>
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
        <h2>Commande annulée</h2>
        <p>Votre commande a été annulée. Voici les détails transmis par le restaurant.</p>
        <div className="cancel-modal-summary">
          <div><span>Table</span><strong>{orderTableDisplay(order)}</strong></div>
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

function CancelOrderReasonModal({ order, onClose, onConfirm, onError }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order) setReason('');
  }, [order]);

  if (!order) return null;

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      onError?.('La raison d’annulation est obligatoire.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(order, trimmed);
    } catch (error) {
      onError?.(error.message || "Impossible d'annuler la commande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="order-modal-backdrop">
      <div className="client-cancel-modal cancel-reason-modal">
        <button type="button" className="clean-btn cancel-modal-close" onClick={onClose} aria-label="Fermer">
          <i className="fas fa-times"></i>
        </button>
        <div className="cancel-modal-icon"><i className="fas fa-ban"></i></div>
        <h2>Annuler la commande</h2>
        <p>Expliquez brièvement pourquoi vous souhaitez annuler cette commande.</p>
        <textarea
          className="fctrl cancel-reason-textarea"
          rows="4"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motif d’annulation..."
          autoFocus
        />
        <div className="cancel-reason-actions">
          <button className="receipt-share-btn" type="button" onClick={onClose} disabled={submitting}>
            Fermer
          </button>
          <button className="btn-red" type="button" onClick={submit} disabled={submitting}>
            <i className="fas fa-ban"></i>
            {submitting ? 'Annulation...' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ order, restaurantName, brand, onClose, onStatus }) {
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
            <h2>Votre repas était comment ?</h2>
            <p>Notez votre experience chez {restaurantName || 'Restaurant Scan'}.</p>
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
            <button className="btn-red feedback-primary-action w-100 justify-content-center" type="button" disabled={!canContinue} onClick={() => setStep(2)}>
              Continuer <i className="fas fa-arrow-right"></i>
            </button>
            <button className="feedback-skip clean-btn" type="button" onClick={() => onClose(false)}>Passer</button>
          </>
        ) : (
          <>
            <div className="feedback-icon subtle"><i className="fas fa-comment-dots"></i></div>
            <h2>Recommanderiez-vous ce restaurant ?</h2>
            <p>Votre avis aide les autres clients.</p>
            {brand?.logo_url ? (
              <img className="feedback-restaurant-logo" src={brand.logo_url} alt={restaurantName || 'Restaurant'} />
            ) : null}
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
              rows="2"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Un commentaire ? Ce que vous avez aime, ce qui pourrait etre ameliore... (optionnel)"
            />
            {error && <div className="client-alert error">{error}</div>}
            <div className="feedback-actions">
              <button className="receipt-share-btn feedback-secondary-action" type="button" onClick={() => setStep(1)}>Retour</button>
              <button className="btn-red feedback-primary-action" type="button" disabled={sending || recommended === null} onClick={sendFeedback}>
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
  const defaultNames = ['menu digital', 'menu digital qr code', 'restaurant scan'];
  const defaultSlogans = ['menu digital', 'menu digital qr code', 'fast food & restaurant'];
  const customName = String(settings.app_name || '').trim();
  const customSlogan = String(settings.slogan || restaurant.slogan || '').trim();
  const customDescription = String(settings.description || restaurant.description || '').trim();
  const displayName = customName && !defaultNames.includes(customName.toLowerCase())
    ? customName
    : restaurant.name || 'Restaurant Scan';
  const displaySlogan = customSlogan;
  const displayDescription = customDescription && !defaultSlogans.includes(customDescription.toLowerCase())
    ? customDescription
    : '';
  const defaultTheme = {
    primary: '#ff7a1a',
    secondary: '#d71920',
    background: '#fff7ef',
  };
  const primaryColor = normalizeThemeColor(
    theme.primary || theme.primary_color || theme.accent || settings.primary_color || restaurant.primary_color,
    defaultTheme.primary,
  );
  const backgroundColor = normalizeThemeColor(
    theme.background || theme.background_color || theme.surface || settings.background_color || restaurant.background_color,
    defaultTheme.background,
  );
  const clientTheme = {
    primary: primaryColor,
    secondary: primaryColor,
    background: backgroundColor,
  };

  return {
    id: restaurant.id || '',
    name: displayName,
    slug: restaurant.slug || '',
    currency: restaurant.currency || settings.currency || 'CDF',
    settings: {
      ...settings,
      usd_cdf_rate: Number(settings.usd_cdf_rate || settings.exchange_rate_usd_cdf || 2850),
    },
    logo_url: restaurant.logo_url || '/img/logo/e-resto-logo.png',
    has_restaurant_logo: Boolean(restaurant.logo_url),
    slogan: displaySlogan,
    description: displayDescription || displaySlogan || `Menu digital de ${displayName}`,
    owner_phone: restaurant.owner_phone || '',
    whatsapp_order_phone: settings.whatsapp_order_phone || restaurant.whatsapp_order_phone || restaurant.owner_phone || '',
    address: restaurant.address || '',
    city: restaurant.city || '',
    can_feedback: Boolean(restaurant.can_feedback),
    can_reservations: Boolean(restaurant.can_reservations),
    can_group_orders: Boolean(restaurant.can_group_orders),
    can_mobile_money: Boolean(restaurant.can_mobile_money),
    can_chatbot: Boolean(restaurant.can_chatbot),
    payment_methods: restaurant.payment_methods || ['cash'],
    theme: clientTheme,
  };
}

function normalizeThemeColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : fallback;
}

function canShowFeedbackForOrder(order) {
  return order?.payment_status === 'paid';
}

function openRestaurantMenuFromFeedbackLink(order, tableId) {
  clearRememberedOrder(tableId);

  const restaurantSlug = order?.restaurant?.slug || new URLSearchParams(window.location.search).get('restaurant_slug');
  const url = new URL(window.location.href);
  url.searchParams.delete('table_id');
  url.searchParams.delete('order_id');
  url.searchParams.delete('tracking_code');
  url.searchParams.delete('feedback');
  url.searchParams.delete('menu');

  if (restaurantSlug) {
    url.searchParams.set('restaurant_slug', restaurantSlug);
  }

  window.setTimeout(() => {
    window.location.replace(url.toString());
  }, 900);
}

function exitClientAppAfterFeedback() {
  window.setTimeout(() => {
    window.close();
    window.location.replace('about:blank');
  }, 700);
}

function applyClientTheme(brand) {
  const root = document.documentElement;
  root.style.setProperty('--primary', brand.theme.primary);
  root.style.setProperty('--secondary', brand.theme.primary);
  root.style.setProperty('--client-bg', brand.theme.background);
  root.style.setProperty('--client-gradient', brand.theme.primary);
}

function getStatusNotificationMessage(status) {
  const messages = {
    pending: 'Votre commande a été reçue par le restaurant.',
    preparing: 'Votre commande est maintenant en préparation.',
    ready: 'Votre commande est prête. Elle arrive bientôt.',
    delivered: 'Votre commande a été servie. Bon appétit.',
    paid: 'Paiement confirmé. Merci pour votre visite.',
    cancelled: 'Votre commande a été annulée.',
  };

  return messages[status] ?? 'Le statut de votre commande a changé.';
}

function notifyBrowser(title, message) {
  if (!('Notification' in window)) return;

  const show = () => {
    if (Notification.permission === 'granted') {
      new Notification(`Restaurant Scan - ${title}`, {
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

  const prime = () => {
    try {
      const oscillator = notificationAudioContext.createOscillator();
      const gain = notificationAudioContext.createGain();
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(notificationAudioContext.destination);
      oscillator.start();
      oscillator.stop(notificationAudioContext.currentTime + 0.03);
      notificationAudioUnlocked = true;
    } catch {
      notificationAudioUnlocked = false;
    }
  };

  if (notificationAudioContext.state === 'suspended') {
    notificationAudioContext.resume().then(prime).catch(() => {
      notificationAudioUnlocked = false;
    });
    return;
  }

  prime();
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
    notificationAudioContext.resume().then(() => {
      notificationAudioUnlocked = true;
      play();
    }).catch(() => undefined);
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



