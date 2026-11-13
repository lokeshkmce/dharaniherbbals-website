import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { ShoppingCart, ShieldCheck, Leaf, Truck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Share2, MessageCircle, Camera, Copy, Check, Package, Plus, Star, MessageSquare, FileText, CheckCircle, ArrowLeft, Sparkles, Compass, Info, X, Edit3, Send, Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import imgLifestyle from '../assets/herbal_lifestyle.webp';
import imgIngredients from '../assets/herbal_ingredients.webp';
import imgTexture from '../assets/herbal_texture.webp';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import { useLanguage, getCategoryDisplayName, getBrandDisplayName } from '../context/LanguageContext';
import { API_BASE_URL, resolveMediaUrl } from '../services/api';
import { formatProductPackSize, formatVariationLabel, formatProductDisplayName, formatCurrency, getProductFallbackImage } from '../utils/productFormatters';
import { getDefaultVariation } from '../data/productVariationsData';
import { getProductDescription, getProductIngredients, getProductDirections } from '../data/productCatalogData';
import SeoHead from '../components/SeoHead';
import { generateProductSeo } from '../utils/productSeo';
import { checkDeliveryPincode, isValidIndianPin } from '../utils/deliveryChecker';
import { getVerifiedReviewData, getProductReviewsAndSummary } from '../utils/productReviews';
import './ProductDetails.css';

export default function ProductDetails() {
  const { id: rawId } = useParams();
  // Legacy or offer alias: 1243 maps to 1394 (Wild Turmeric)
  const id = String(rawId) === '1243' ? '1394' : rawId;
  const navigate = useNavigate();
  const { products, loading, getProductById } = useProducts();
  const { language, translateText, translateProduct, bulkProductNames, t } = useLanguage();
  const contextProduct = (getProductById ? getProductById(id) : null) || products.find(p => p.id === parseInt(id));
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [isFetchingDirect, setIsFetchingDirect] = useState(!contextProduct && Boolean(id));
  const product = contextProduct || fetchedProduct;
  const sliderRef = useRef(null);
  const trackRef = useRef(null);
  const thumbRefs = useRef([]);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openAccordion, setOpenAccordion] = useState({ desc: true, benefits: true, ingredients: false, directions: false, delivery: false, reviews: false });
  const toggleAccordion = (key) => setOpenAccordion(prev => ({ ...prev, [key]: !prev[key] }));
  const [showDesktopBuyBar, setShowDesktopBuyBar] = useState(false);

  // Customer write review modal & form state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [newReviewerName, setNewReviewerName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.name || u.full_name || u.first_name || (u.user && (u.user.name || u.user.full_name)) || '';
    } catch {
      return '';
    }
  });
  const [newReviewText, setNewReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleScroll = () => {
      setShowDesktopBuyBar(window.scrollY > 380);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Open review modal if directed via ?writeReview=true
  useEffect(() => {
    if (searchParams.get('writeReview') === 'true') {
      setShowReviewModal(true);
      setTimeout(() => {
        document.getElementById('customer-reviews')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [searchParams]);

  useEffect(() => {
    if (product?.has_3d || product?.model_3d) {
      if (!document.getElementById('model-viewer-script')) {
        const script = document.createElement('script');
        script.id = 'model-viewer-script';
        script.type = 'module';
        script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
        document.head.appendChild(script);
      }
    }
  }, [product]);

  // Load locally saved customer reviews from browser storage
  const getLocalCustomerReviews = (prodId) => {
    try {
      const raw = localStorage.getItem(`customer_reviews_${prodId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleDeleteReview = (reviewId) => {
    const existingLocal = getLocalCustomerReviews(id);
    const updatedLocal = existingLocal.filter(r => r.id !== reviewId);
    try {
      localStorage.setItem(`customer_reviews_${id}`, JSON.stringify(updatedLocal));
    } catch (e) { }
    setReviews(prev => prev.filter(r => r.id !== reviewId));
  };


  useEffect(() => {
    const fetchReviewsAndSummary = async () => {
      if (!id) return;
      setReviews([]);
      setReviewSummary(null);

      const currentProduct = (getProductById ? getProductById(id) : null) || products.find(p => p.id === parseInt(id));
      const local = getLocalCustomerReviews(id);

      try {
        const res = await getProductReviewsAndSummary(id, currentProduct?.name || '');
        const combined = [...local, ...((res && res.reviews) || [])];
        setReviews(combined);
        setReviewSummary(res && res.summary ? res.summary : null);
      } catch (err) {
        console.error("Failed to fetch product reviews or summary", err);
        setReviews(local);
        setReviewSummary(null);
      }
      };
    fetchReviewsAndSummary();
  }, [id, products]);

  const handleCustomerReviewSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setReviewError('');
    setIsSubmittingReview(true);

    const finalRating = Number(newRating) || 5;
    const finalName = newReviewerName.trim() || 'Customer';
    const finalText = newReviewText.trim() || 'Great herbal product!';

    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    const assignedColor = colors[Math.floor(Math.random() * colors.length)];

    const newRev = {
      id: `rev_${Date.now()}`,
      name: finalName,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rating: finalRating,
      text: finalText,
      initial: (finalName.charAt(0) || 'C').toUpperCase(),
      color: assignedColor,
      verified: true,
      isLocal: true
    };

    // 1. Save locally to localStorage so it permanently stays for this product
    try {
      const existing = getLocalCustomerReviews(id);
      const updated = [newRev, ...existing.filter(r => r.id !== newRev.id)];
      localStorage.setItem(`customer_reviews_${id}`, JSON.stringify(updated));
    } catch (err) {
      console.warn('Could not save review locally:', err);
    }

    // 2. Prepend to state so it appears below immediately
    setReviews(prev => [newRev, ...prev]);

    // 3. Attempt API submission to backend in background
    try {
      const storedUser = localStorage.getItem('user');
      let userId = null;
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const u = parsed.user || parsed;
        userId = u.id || u.user_id;
      }

      const payload = {
        rating: finalRating,
        review_text: finalText,
        product_id: parseInt(id)
      };
      if (userId) payload.user_id = userId;

      fetch(`${API_BASE_URL}/reviews/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload)
      }).catch(() => { });
    } catch (apiErr) {
      // Handled gracefully
    }

    setIsSubmittingReview(false);
    setReviewSuccessMsg(true);

    setTimeout(() => {
      setShowReviewModal(false);
      setReviewSuccessMsg(false);
      setNewReviewText('');
      setNewRating(5);
      // Smoothly scroll down to reviews below
      setTimeout(() => {
        const el = document.getElementById('customer-reviews-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }, 900);
  };

  // Auto-scroll logic for the slider
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider || reviews.length <= 2) return;

    let isPaused = false;
    let animationId;

    const handleMouseEnter = () => isPaused = true;
    const handleMouseLeave = () => isPaused = false;

    slider.addEventListener('mouseenter', handleMouseEnter);
    slider.addEventListener('mouseleave', handleMouseLeave);
    slider.addEventListener('touchstart', handleMouseEnter, { passive: true });
    slider.addEventListener('touchend', handleMouseLeave);

    const scroll = () => {
      if (!isPaused) {
        if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1) {
          slider.scrollLeft = 0;
        } else {
          slider.scrollLeft += 0.5; // Decreased Speed adjustment
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animationId);
      if (slider) {
        slider.removeEventListener('mouseenter', handleMouseEnter);
        slider.removeEventListener('mouseleave', handleMouseLeave);
        slider.removeEventListener('touchstart', handleMouseEnter);
        slider.removeEventListener('touchend', handleMouseLeave);
      }
    };
  }, [reviews]);


  const verifiedReviewData = getVerifiedReviewData(product);

  const baseCount = (reviewSummary && typeof reviewSummary.total_reviews === 'number' && reviewSummary.total_reviews > 0)
    ? reviewSummary.total_reviews
    : (verifiedReviewData ? verifiedReviewData.reviews : (product && product.reviews && Number(product.reviews) > 0 ? Number(product.reviews) : 0));

  const totalReviews = Math.max(baseCount, Array.isArray(reviews) ? reviews.length : 0);

  const rawAvg = (Array.isArray(reviews) && reviews.length > 0)
    ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length)
    : (reviewSummary && Number(reviewSummary.average_rating) > 0
      ? Number(reviewSummary.average_rating)
      : (verifiedReviewData ? verifiedReviewData.rating : (product && product.rating && Number(product.rating) > 0 ? Number(product.rating) : 5)));

  const avgRating = (!isNaN(rawAvg) && rawAvg > 0) ? rawAvg : 5;

  const hasValidReviews = totalReviews > 0;

  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  useEffect(() => {
    if (thumbRefs.current && thumbRefs.current[currentImgIndex]) {
      thumbRefs.current[currentImgIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentImgIndex]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [crmGalleryImages, setCrmGalleryImages] = useState([]);
  const [fetchedVariations, setFetchedVariations] = useState([]);
  const [fetchedKeyBenefits, setFetchedKeyBenefits] = useState([]);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [pinCode, setPinCode] = useState(() => {
    try {
      return localStorage.getItem('dharani_delivery_pincode') || '';
    } catch {
      return '';
    }
  });
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [isCheckingPin, setIsCheckingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  // Auto-check if previously verified PIN exists
  useEffect(() => {
    if (pinCode && pinCode.length === 6 && isValidIndianPin(pinCode)) {
      checkDeliveryPincode(pinCode).then(res => {
        if (res.success && res.deliverable) {
          setDeliveryInfo(res);
        }
      }).catch(() => { });
    }
  }, []);

  const handleVerifyPincode = async () => {
    const cleanPin = pinCode.trim();
    if (!cleanPin || cleanPin.length !== 6 || !isValidIndianPin(cleanPin)) {
      setPinError('Enter a valid 6-digit Indian PIN code (e.g. 641001)');
      setDeliveryInfo(null);
      return;
    }
    setPinError('');
    setIsCheckingPin(true);
    try {
      const res = await checkDeliveryPincode(cleanPin);
      if (res.success && res.deliverable) {
        setDeliveryInfo(res);
        setPinError('');
        try {
          localStorage.setItem('dharani_delivery_pincode', cleanPin);
        } catch (e) { }
      } else {
        setPinError(res.message || 'PIN code could not be verified for courier serviceability');
        setDeliveryInfo(null);
      }
    } catch (e) {
      setPinError('Could not verify PIN code. Please try again.');
      setDeliveryInfo(null);
    } finally {
      setIsCheckingPin(false);
    }
  };

  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [benefitsExpanded, setBenefitsExpanded] = useState(true);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(true);
  const [ingredientsTab, setIngredientsTab] = useState('key');
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const defaultDesc = "Experience the incredible benefits of our completely natural, 100% organic herbal formulation. Carefully crafted using traditional methods and sustainably sourced ingredients to ensure the highest quality for your holistic wellness journey. Free from harmful chemicals, parabens, and artificial preservatives.";

  // Translation states
  const [translatedName, setTranslatedName] = useState(product ? formatProductDisplayName(product.name) : '');
  const [translatedSubtitle, setTranslatedSubtitle] = useState(product ? product.subtitle : '');
  const [translatedDesc, setTranslatedDesc] = useState(product ? (getProductDescription(product) || product.description || defaultDesc) : '');

  // If product is not in global context (e.g. newly created on backend), fetch directly by ID
  useEffect(() => {
    if (!contextProduct && id) {
      setIsFetchingDirect(true);
      const endpoints = [
        `/api/products/${id}/`,
        `${API_BASE_URL}/products/${id}/`,
        `http://179.197.251.47:30080/herbal/products/${id}/`
      ];

      let isMounted = true;
      (async () => {
        for (const url of endpoints) {
          try {
            const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const data = await res.json();
              const p = data.data || data;
              if (p && p.id && isMounted) {
                const priceNum = parseFloat(p.customer_price || p.price || p.mrp || 0);
                const mrpNum = parseFloat(p.mrp || p.price || 0);
                const resolvedImg = resolveMediaUrl(p.image) || '/logo.png';
                const formattedP = {
                  ...p,
                  name: formatProductDisplayName(p.name),
                  raw_name: p.name,
                  tamil_name: formatProductDisplayName(p.tamil_name || p.name),
                  price: formatCurrency(priceNum),
                  originalPrice: mrpNum > priceNum ? formatCurrency(mrpNum) : '',
                  discount: mrpNum > priceNum ? `${Math.round(((mrpNum - priceNum) / mrpNum) * 100)}% OFF` : '',
                  image: resolvedImg,
                  extra_images: Array.isArray(p.extra_images) ? p.extra_images.map(img => resolveMediaUrl(img)).filter(Boolean) : [],
                  category_name: p.category_name || (p.category === 7 ? 'Health & Wellness' : 'Herbal Care'),
                  description: p.description || '',
                  pack_size: formatProductPackSize(p) || '50g',
                  rating: 5.0,
                  reviews: 1,
                  variations: Array.isArray(p.variations) ? p.variations : []
                };
                setFetchedProduct(formattedP);
                setTranslatedName(formatProductDisplayName(formattedP.name));
                setTranslatedSubtitle(formattedP.subtitle || '100% Authentic Botanical Care');
                setTranslatedDesc(getProductDescription(formattedP) || formattedP.description || defaultDesc);
                setIsFetchingDirect(false);
                return;
              }
            }
          } catch (e) {}
        }
        if (isMounted) setIsFetchingDirect(false);
      })();

      return () => { isMounted = false; };
    } else {
      setIsFetchingDirect(false);
    }
  }, [id, contextProduct]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setCurrentImgIndex(0);
    setQuantity(1);
    setActiveTab('description'); setCrmGalleryImages([]); setFetchedVariations([]); setFetchedKeyBenefits([]);
    let active = true;

    if (id) {
      // Fetch CRM product images for Product Gallery section
      fetch(`${API_BASE_URL}/product-images/?product_id=${id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      })
        .then(res => {
          if (!res.ok) {
            // Silently ignore 404s as it just means no extra images exist
            if (res.status === 404) return null;
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (active && data) {
            // Check if the response itself is an array, or if it's wrapped in data/success
            let imagesArray = [];
            if (Array.isArray(data)) {
              imagesArray = data;
            } else if (data.data && Array.isArray(data.data)) {
              imagesArray = data.data;
            } else if (data.images && Array.isArray(data.images)) {
              imagesArray = data.images;
            }

            setCrmGalleryImages(imagesArray);
          }
        })
        .catch(err => {
          if (active) console.warn("Failed to fetch CRM product images:", err.message);
        });

      // Fetch CRM product key benefits
      fetch(`${API_BASE_URL}/products/${id}/key-points/`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      })
        .then(res => {
          if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (active && data) {
            // Check if it's an array of strings, or array of objects, or object with data array
            let points = [];
            if (Array.isArray(data)) {
              points = data;
            } else if (data.data && Array.isArray(data.data)) {
              points = data.data;
            } else if (data.key_points && Array.isArray(data.key_points)) {
              points = data.key_points;
            }
            // Map objects to strings if needed. Do not fallback to JSON.stringify if all fields are null.
            points = points.map(p => typeof p === 'object' ? (p.point || p.text || p.title || p.benefit || p.name || null) : p);

            // Filter out null or empty strings
            const validPoints = points.filter(p => p !== null && p !== undefined && p !== '');
            setFetchedKeyBenefits(validPoints);
          }
        })
        .catch(err => {
          if (active) console.warn("Failed to fetch CRM product key benefits:", err.message);
        });

      // Fetch CRM product variations
      fetch(`${API_BASE_URL}/products/${id}/variations/`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      })
        .then(res => {
          if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (active && data && Array.isArray(data)) {
            const formattedVariations = data.map(v => {
              // Check if the user is a store member
              let isStoreMember = false;
              try {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                  const userData = JSON.parse(storedUser);
                  isStoreMember = userData.is_store_login ||
                    userData.user?.role === 'staff' ||
                    userData.is_store_member ||
                    userData.role === 'store' ||
                    userData.role === 'store_member' ||
                    userData.user_type === 'store' ||
                    userData.user?.role === 'store' ||
                    userData.user?.role === 'store_member' ||
                    userData.user?.user_type === 'store' ||
                    userData.user?.is_store_member ||
                    userData.is_store;
                }
              } catch (e) { }

              let activePrice = 0;
              let originalPrice = 0;

              if (isStoreMember) {
                activePrice = parseFloat(v.store_price) || parseFloat(v.customer_price) || parseFloat(v.price) || parseFloat(v.sale_price) || parseFloat(v.mrp) || 0;
                originalPrice = parseFloat(v.mrp) || parseFloat(v.original_price) || activePrice;
              } else {
                activePrice = parseFloat(v.customer_price) || parseFloat(v.price) || parseFloat(v.sale_price) || parseFloat(v.mrp) || 0;
                originalPrice = parseFloat(v.mrp) || parseFloat(v.original_price) || activePrice;
              }

              let discount = '';
              if (originalPrice > activePrice) {
                discount = `${Math.round(((originalPrice - activePrice) / originalPrice) * 100)}% OFF`;
              }
              return {
                ...v,
                price: formatCurrency(activePrice),
                originalPrice: originalPrice > activePrice ? formatCurrency(originalPrice) : '',
                discount: discount
              };
            });
            setFetchedVariations(formattedVariations);
            if (formattedVariations.length > 0) {
              setSelectedVariation(prev => {
                if (prev) {
                  const match = formattedVariations.find(fv => String(fv.id || fv.variation_id) === String(prev.id || prev.variation_id));
                  if (match) return match;
                }
                return getDefaultVariation(product, formattedVariations) || formattedVariations[0];
              });
            }
          }
        })
        .catch(err => {
          if (active) console.warn("Failed to fetch CRM product variations:", err.message);
        });
    }

    return () => {
      active = false;
    };
  }, [id, product]);

  useEffect(() => {
    if (fetchedVariations.length === 0) {
      if (product && product.variations && product.variations.length > 0) {
        setSelectedVariation(prev => {
          if (prev) {
            const match = product.variations.find(v => String(v.id || v.variation_id) === String(prev.id || prev.variation_id));
            if (match) return match;
          }
          return product.selected_variation || product.default_variation || getDefaultVariation(product, product.variations) || product.variations[0];
        });
      } else {
        setSelectedVariation(null);
      }
    }
  }, [product?.id, product?.variations, product?.default_variation, product?.selected_variation, fetchedVariations.length]);

  const translatedRef = useRef(null); // tracks "productId:lang" already translated
  const shareMenuRef = useRef(null);

  useEffect(() => {
    if (!product) return;

    const key = `${product.id}:${language}`;
    // Skip if we already ran translation for this exact product+language combo
    if (translatedRef.current === key) return;
    translatedRef.current = key;

    let active = true;

    // Direct assignment for product name
    setTranslatedName(formatProductDisplayName(language === 'ta' && product.tamil_name ? product.tamil_name : product.name));

    setTranslatedSubtitle(product.subtitle);
    const activeBaseDesc = getProductDescription(product) || product.description || defaultDesc;
    setTranslatedDesc(activeBaseDesc);

    if (language === 'ta') {
      // 2. Subtitle (single call, not per-card)
      if (product.subtitle) {
        translateText(product.subtitle).then(res => {
          if (active && res) setTranslatedSubtitle(res);
        });
      }

      // 3. Description (single call)
      translateText(activeBaseDesc).then(res => {
        if (active && res) setTranslatedDesc(res);
      });
    }

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, product?.id, bulkProductNames]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const productIngredients = product ? getProductIngredients(product) : [];
  const productDirections = product ? getProductDirections(product) : [];

  const productSeo = useMemo(() => {
    if (!product) return null;
    return generateProductSeo(product, {
      language,
      selectedVariation,
      reviewSummary,
      verifiedReviews: reviews
    });
  }, [product, language, selectedVariation, reviewSummary, reviews]);

  // Smart, relevance-ranked related products from existing product catalog
  const relatedProducts = useMemo(() => {
    if (!product || !products || products.length === 0) return [];

    const currentCat = (product.category_name || '').toLowerCase();
    const currentName = (product.name || '').toLowerCase();
    const currentIngs = (productIngredients || []).join(' ').toLowerCase();

    const candidates = products.filter(p => p.id !== product.id);

    // Score candidates based on relevance
    const scored = candidates.map(p => {
      let score = 0;
      const pCat = (p.category_name || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const pDesc = (p.description || '').toLowerCase();

      // Same category gets strong relevance
      if (pCat && currentCat && pCat === currentCat) {
        score += 15;
      }

      // Shared key botanical ingredients or keywords
      const keyHerbs = ['hibiscus', 'onion', 'amla', 'aloe', 'turmeric', 'neem', 'shikakai', 'vetiver', 'ginger', 'pepper', 'nalangu', 'pickle'];
      keyHerbs.forEach(herb => {
        if ((currentName.includes(herb) || currentIngs.includes(herb)) && (pName.includes(herb) || pDesc.includes(herb))) {
          score += 10;
        }
      });

      // Products with valid image get slight priority
      if (p.image && p.image.trim()) {
        score += 2;
      }

      return { product: p, score };
    });

    // Sort descending by relevance score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 6).map(s => s.product);
  }, [product, products, productIngredients]);

  if (loading || isFetchingDirect) {
    return <div className="pd-pro-wrapper"><div style={{ padding: '100px', textAlign: 'center' }}>Loading product details...</div></div>;
  }

  if (!product) {
    return (
      <div className="pd-pro-wrapper empty">
        <h2>Product not found!</h2>
        <Link to="/shop" className="btn-pro-primary mt-4" style={{ width: 'auto', textDecoration: 'none', padding: '16px 32px' }}>Return to Shop</Link>
      </div>
    );
  }

  const mediaItems = [];
  const fallbackImg = getProductFallbackImage(product.raw_name || product.name, product.id) || getProductFallbackImage(product.name, product.id);

  // 1. Primary product image (the EXACT image shown on the card outside) MUST ALWAYS be first!
  if (product.image && !product.image.includes('Vaishnavi.jpeg') && !product.image.endsWith('/logo.png')) {
    const rawImages = typeof product.image === 'string' && product.image.includes(',')
      ? product.image.split(',').map(s => s.trim()).filter(Boolean)
      : [product.image];

    for (const img of rawImages) {
      if (img.includes('Vaishnavi.jpeg') || img.endsWith('/logo.png')) continue;
      const pSrc = resolveMediaUrl(img);
      if (pSrc && !mediaItems.some(m => m.src === pSrc)) {
        mediaItems.push({ type: 'image', src: pSrc, thumb: pSrc });
      }
    }
  }

  // If primary image was missing/broken, use authentic fallback
  if (mediaItems.length === 0 && fallbackImg) {
    mediaItems.push({ type: 'image', src: fallbackImg, thumb: fallbackImg });
  }

  // 2. Extra gallery images from CRM come AFTER the primary product image
  if (Array.isArray(product.extra_images) && product.extra_images.length > 0) {
    product.extra_images.forEach(img => {
      if (!img || img.includes('Vaishnavi.jpeg') || img.endsWith('/logo.png')) return;
      const src = resolveMediaUrl(img);
      if (src && !mediaItems.some(m => m.src === src)) {
        mediaItems.push({ type: 'image', src, thumb: src });
      }
    });
  }
  if (crmGalleryImages.length > 0) {
    crmGalleryImages.forEach(imgObj => {
      const raw = imgObj.image || imgObj.url;
      if (raw && (raw.includes('Vaishnavi.jpeg') || raw.endsWith('/logo.png'))) return;
      const src = resolveMediaUrl(raw);
      if (src && !mediaItems.some(m => m.src === src)) {
        // Exclude double-bottle legacy image for Chemparuthi shampoo & Arappu shampoo
        
        mediaItems.push({ type: 'image', src, thumb: src });
      }
    });
  }

  // 3. 3D Model if available
  if (product.model_3d) {
    mediaItems.push({
      type: '3d',
      src: resolveMediaUrl(product.model_3d),
      thumb: mediaItems[0]?.src || fallbackImg || '/logo.png'
    });
  }

  // 4. Fallback if no images found
  if (mediaItems.length === 0) {
    const safeImg = fallbackImg || '/logo.png';
    mediaItems.push({ type: 'image', src: safeImg, thumb: safeImg });
  }

  
  const calculatedBenefits = (() => {
    if (fetchedKeyBenefits && fetchedKeyBenefits.length > 0) return fetchedKeyBenefits;
    const name = (product.name || '').toLowerCase();
    const category = (product.category_name || '').toLowerCase();
    const idHash = product.id ? product.id : (product.name ? product.name.length : 1);
    let pool = [];
    if (name.includes('black tea')) {
      pool = ['Refreshing Daily Brew', 'Natural Antioxidant Support', 'Boosts Focus and Alertness', 'Smooth Energy Lift'];
    } else if (name.includes('jaggery')) {
      pool = ['Natural Sweetener', 'Rich in Minerals', 'Made from Pure Sugarcane', 'Better Than Refined Sugar'];
    } else if (name.includes('rose gel') || name.includes('rose')) {
      pool = ['Rose-Infused Hydration', 'Oil-Free Freshness', 'Soothes Sensitive Skin', 'Helps Reduce Blackheads'];
    } else if (name.includes('green gram')) {
      pool = ['Gentle Skin Exfoliation', 'Unclogs Pores', 'Brightens Skin', 'Natural Face Pack Base'];
    } else if (name.includes('herbal tea')) {
      pool = ['Immune Shield', 'Respiratory Care', 'Throat Comfort', 'Liver Wellness'];
    } else if (name.includes('ginger') && name.includes('coffee')) {
      pool = ['Herbal Cold Relief', 'Natural Body Warmth', 'Respiratory Comfort', 'Digestive Support'];
    } else if (name.includes('aavaram')) {
      pool = ['Inner Body Cooling', 'Radiant Skin Support', 'Natural Body Cleanse', 'Herbal Rejuvenation'];
    } else if (name.includes('guava')) {
      pool = ['Polyphenol-Rich Goodness', 'Supports Glucose Balance', 'Heart-Friendly Botanicals', 'Metabolic Balance Support'];
    } else if (name.includes('coconut') || name.includes('soap')) {
      pool = ['Deeply Moisturizes Skin', 'Gently Cleanses Without Drying', 'Leaves Skin Soft and Smooth', 'Suitable for Daily Use'];
    } else if (name.includes('karisalankanni') || name.includes('karisalankanni shampoo')) {
      pool = ['Supports Natural Hair Darkening', 'Root-to-Tip Nourishment', 'Herbal Scalp Rejuvenation', 'Botanical Hair Revival'];
    } else if (name.includes('hair') || category.includes('hair') || name.includes('shampoo') || name.includes('oil')) {
      pool = ['Strengthens Roots', 'Reduces Hair Fall', 'Adds Natural Shine', 'Improves Scalp Health', 'Controls Dandruff', 'Repairs Split Ends'];
    } else if (name.includes('face') || name.includes('skin') || name.includes('glow') || category.includes('skin') || name.includes('maavu') || name.includes('gel')) {
      pool = ['Brightens Skin Tone', 'Clears Blemishes', 'Deep Hydration', 'Anti-aging Properties', 'Tightens Pores', 'Provides Radiant Glow'];
    } else {
      pool = ['Boosts Immunity', 'Improves Digestion', 'Rich in Iron', 'Increases Energy', 'Purifies Blood', '100% Natural Ingredients'];
    }
    let benefits = [];
    if (pool.length <= 4) benefits = [...pool];
    else {
      const maxStartIndex = Math.max(1, pool.length - 4);
      const startIndex = idHash % maxStartIndex;
      const step = (idHash % 3) + 1;
      for (let i = 0; i < 4; i++) {
        benefits.push(pool[(startIndex + (i * step)) % pool.length]);
      }
    }
    return benefits;
  })();

  const currentMedia = mediaItems[currentImgIndex];
  const getProductShareUrl = () => {
    if (typeof window === 'undefined') return `https://www.dharaniherbbals.in/product/${product.id}`;
    return `${window.location.origin}/product/${product.id}`;
  };

  const getShareText = () => {
    const price = selectedVariation?.price || product.price;
    const formattedPrice = price ? ` - ₹${parseFloat(String(price).replace(/[^0-9.]/g, '')).toFixed(0)}` : '';
    const packSize = selectedVariation ? formatVariationLabel(selectedVariation) : (product.pack_size || formatProductPackSize(product));
    const sizeText = packSize ? ` (${packSize})` : '';
    const shareUrl = getProductShareUrl();

    let text = `🌿 Check out *${translatedName}*${sizeText}${formattedPrice} on Dharani Herbals!\n`;
    text += `✨ 100% Authentic South Indian Botanical Care\n\n`;
    text += `👉 View product details & order online:\n${shareUrl}`;
    return text;
  };

  const copyShareLink = async () => {
    const shareUrl = getProductShareUrl();
    if (!shareUrl) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2000);
  };

  const shareToWhatsApp = () => {
    const message = encodeURIComponent(getShareText());
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const shareToInstagram = async () => {
    await copyShareLink();
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    setShowShareMenu(false);
  };

  const shareNative = async () => {
    const shareUrl = getProductShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: translatedName,
          text: translatedSubtitle || translatedName,
          url: shareUrl
        });
      } catch {
        // User cancelled the native share sheet.
      }
    } else {
      await copyShareLink();
    }
    setShowShareMenu(false);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;
    if (diff > threshold) {
      // Swiped left -> Next image
      const nextIdx = (currentImgIndex + 1) % mediaItems.length;
      setCurrentImgIndex(nextIdx);
    } else if (diff < -threshold) {
      // Swiped right -> Previous image
      const nextIdx = (currentImgIndex - 1 + mediaItems.length) % mediaItems.length;
      setCurrentImgIndex(nextIdx);
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const isFirstSlide = currentImgIndex === 0;
  const isLastSlide = currentImgIndex === mediaItems.length - 1;

  const handlePrevSlide = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isFirstSlide) return;
    setCurrentImgIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextSlide = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isLastSlide) return;
    setCurrentImgIndex((prev) => Math.min(mediaItems.length - 1, prev + 1));
  };

  return (
    <div className="pd-pro-wrapper">
      {productSeo && <SeoHead {...productSeo} />}
      {/* Breadcrumbs & Back Button */}
      <div className="pd-breadcrumbs">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="pd-back-circle-btn"
          title="Go Back"
          aria-label="Go Back"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="pd-breadcrumbs-track">
          <Link to="/">{t('home')}</Link>
          <span className="separator">/</span>
          {product.category_name && (
            <>
              <Link to={`/shop?category=${encodeURIComponent(product.category_name)}`}>
                {language === 'ta' ? getCategoryDisplayName(product.category_name, 'ta') : product.category_name}
              </Link>
              <span className="separator">/</span>
            </>
          )}
          <span className="current">{translatedName}</span>
        </div>
      </div>

      <div className="pd-pro-container pd-nike-layout">
        {/* Mobile-Only Header Block: Brand, Category, Title & Rating above Image Gallery */}
        <div className="pd-nike-mobile-header">
          <div className="pd-nike-brand-cat-row">
            {product.brand && (
              <span className="pd-nike-brand-pill">
                {language === 'ta' ? getBrandDisplayName(product.brand, 'ta') : product.brand}
              </span>
            )}
            <span className="pd-nike-category">
              {(language === 'ta' ? getCategoryDisplayName(product.category_name, 'ta') : product.category_name) || (language === 'ta' ? 'மூலிகை பராமரிப்பு' : 'Herbal Care')} • {language === 'ta' ? '100% மூலிகை' : '100% Botanical'}
            </span>
          </div>
          <h1 className="pd-nike-mobile-title">{translatedName}</h1>
          {hasValidReviews && (
            <div className="pd-nike-rating-row" style={{ marginTop: '4px' }}>
              <div className="pd-nike-rating-pill">
                <Star size={13} fill="#111111" color="#111111" />
                <span className="pd-nike-rating-val">{avgRating.toFixed(1)}</span>
              </div>
              <span className="pd-nike-reviews-link" style={{ fontSize: '0.82rem' }}>
                ({reviews?.length || 4} Reviews)
              </span>
            </div>
          )}
        </div>
        {/* Left Column: Nike-style Media Gallery (Dual Column on Desktop) */}
        <div className="pd-nike-gallery-wrapper">
          {mediaItems.length > 1 && (
            <div className="pd-nike-thumbs-vertical" role="tablist" aria-label="Product thumbnails">
              {mediaItems.map((media, idx) => (
                <button
                  key={idx}
                  type="button"
                  ref={(el) => (thumbRefs.current[idx] = el)}
                  className={`pd-nike-thumb-btn ${currentImgIndex === idx ? 'active' : ''}`}
                  onClick={() => setCurrentImgIndex(idx)}
                  onMouseEnter={() => setCurrentImgIndex(idx)}
                  aria-label={`View photo ${idx + 1}`}
                >
                  <img
                    src={media.thumb}
                    alt=""
                    onError={(e) => {
                      if (!e.target.dataset.retried) {
                        e.target.dataset.retried = 'true';
                      }
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main Media Container */}
          <div
            className="pd-pro-main-image-container pd-nike-main-view"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {mediaItems.length > 1 && (
              <>
                <button
                  type="button"
                  className={`pd-gallery-arrow pd-gallery-arrow-prev ${isFirstSlide ? 'disabled' : ''}`}
                  onClick={handlePrevSlide}
                  disabled={isFirstSlide}
                  aria-label="Previous Image"
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`pd-gallery-arrow pd-gallery-arrow-next ${isLastSlide ? 'disabled' : ''}`}
                  onClick={handleNextSlide}
                  disabled={isLastSlide}
                  aria-label="Next Image"
                >
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
              </>
            )}

            <div className="pd-pro-image-track" ref={trackRef}>
              {mediaItems.map((media, idx) => (
                <div
                  key={idx}
                  className={`pd-pro-main-image-wrapper ${currentImgIndex === idx ? 'active' : ''}`}
                >
                  {media.type === '3d' ? (
                    <model-viewer
                      src={media.src}
                      alt={translatedName}
                      auto-rotate
                      camera-controls
                      shadow-intensity="1"
                      environment-image="neutral"
                      style={{ width: '100%', height: '100%', minHeight: '380px', backgroundColor: '#f6f6f6', borderRadius: '8px' }}
                    ></model-viewer>
                  ) : (
                    <img
                      src={media.src || '/logo.png'}
                      alt={`${translatedName} view ${idx + 1}`}
                      className="pd-pro-main-image"
                      fetchPriority={idx === 0 ? "high" : "auto"}
                      loading={idx === 0 ? "eager" : "lazy"}
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        
                        if (fallbackImg && e.target.src !== fallbackImg) {
                          e.target.src = fallbackImg;
                          return;
                        }
                        const safeProductImg = '/logo.png';
                        if (e.target.src !== safeProductImg) {
                          e.target.src = safeProductImg;
                        }
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {product.badge && currentMedia && currentMedia.type !== '3d' && (
              <div className={`pro-badge badge-${product.badgeColor}`}>
                {product.badge}
              </div>
            )}

            <div className="pd-pro-image-share">
              <button
                type="button"
                className={`pd-image-wishlist-trigger ${isInWishlist(product?.id) ? 'is-active' : ''}`}
                onClick={() => product && toggleWishlist(product)}
                aria-label={isInWishlist(product?.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                title={isInWishlist(product?.id) ? "In Wishlist" : "Add to Wishlist"}
              >
                <Heart size={20} fill={isInWishlist(product?.id) ? "#ef4444" : "none"} color={isInWishlist(product?.id) ? "#ef4444" : "#1f2937"} strokeWidth={isInWishlist(product?.id) ? 0 : 2} />
              </button>
              <button
                type="button"
                className="pd-image-share-trigger"
                onClick={shareToWhatsApp}
                aria-label="Share product on WhatsApp"
              >
                <Share2 size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Nike-style Sticky Information */}
        <div className="pd-pro-info pd-nike-sidebar">
          {/* Subtitle & Title */}
          <div className="pd-nike-header-block">
            <span className="pd-nike-category">
              {(language === 'ta' ? getCategoryDisplayName(product.category_name, 'ta') : product.category_name) || (language === 'ta' ? 'மூலிகை பராமரிப்பு' : 'Herbal Care')} • {language === 'ta' ? '100% மூலிகை' : '100% Botanical'}
            </span>
            <h1 className="pd-nike-title">{translatedName}</h1>
            {hasValidReviews ? (
              <div className="pd-nike-rating-row">
                <div className="pd-nike-rating-pill">
                  <Star size={14} fill="#111111" color="#111111" />
                  <span className="pd-nike-rating-val">{avgRating.toFixed(1)}</span>
                </div>
                <button
                  type="button"
                  className="pd-nike-reviews-link"
                  onClick={() => {
                    setOpenAccordion(prev => ({ ...prev, reviews: true }));
                    setTimeout(() => {
                      document.getElementById('nike-accordion-reviews')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                >
                  ({reviews?.length || 4} Reviews)
                </button>
                <span className="pd-nike-dot">•</span>
                <button
                  type="button"
                  className="pd-nike-write-review-btn"
                  onClick={() => setShowReviewModal(true)}
                >
                  + Write a Review
                </button>
              </div>
            ) : (
              <div className="pd-nike-rating-row">
                <button
                  type="button"
                  className="pd-nike-write-review-btn"
                  onClick={() => setShowReviewModal(true)}
                >
                  + Add First Review
                </button>
              </div>
            )}
          </div>

          {/* Pricing Block */}
          <div className="pd-nike-price-section">
            <div className="pd-nike-price-row">
              <span className="pd-nike-price-main">
                {formatCurrency(selectedVariation ? selectedVariation.price : product.price)}
              </span>
              {(() => {
                const currentVar = selectedVariation || product.default_variation;
                const packSize = currentVar ? formatVariationLabel(currentVar, product) : (product.pack_size || formatProductPackSize(product));
                return packSize ? (
                  <span className="pd-nike-pack-tag">({packSize})</span>
                ) : null;
              })()}
              {product.originalPrice && (
                <span className="pd-nike-original-price">{product.originalPrice}</span>
              )}
              {product.discount && (
                <span className="pd-nike-discount-tag">{product.discount}</span>
              )}
            </div>
            <p className="pd-nike-tax-note">
              {t('taxInclusive') || 'Inclusive of all taxes'} (Also includes all applicable duties)
            </p>
          </div>

          {/* Select Size / Pack (Nike Style Tiles) */}
          {((fetchedVariations && fetchedVariations.length > 0) || (product.variations && product.variations.length > 0)) && (
            <div className="pd-nike-sizes-block">
              <div className="pd-nike-sizes-header">
                <span className="pd-nike-sizes-title">Select Size / Pack</span>
                <span className="pd-nike-stock-badge">In Stock</span>
              </div>
              <div className="pd-nike-sizes-grid">
                {(fetchedVariations && fetchedVariations.length > 0 ? fetchedVariations : product.variations).map((v, idx) => {
                  const isSelected = selectedVariation
                    ? String(selectedVariation.id || selectedVariation.variation_id) === String(v.id || v.variation_id)
                    : (product.default_variation_id && String(product.default_variation_id) === String(v.id || v.variation_id));
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`pd-nike-size-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedVariation(v)}
                    >
                      <span className="size-name">{formatVariationLabel(v, product)}</span>
                      <span className="size-price">{formatCurrency(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity and Primary Call-to-Actions (Nike Signature Pill Buttons) */}
          <div className="pd-nike-cta-group">
            <div className="pd-nike-qty-row">
              <span className="pd-nike-qty-label">Quantity:</span>
              <div className="pd-nike-qty-picker">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="qty-num">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className="pd-nike-btn-add"
              onClick={() => addToCart(product, quantity, selectedVariation?.id || selectedVariation?.variation_id || product.default_variation_id)}
            >
              <ShoppingCart size={19} strokeWidth={2.2} />
              <span>{t('addToCart') || 'Add to Cart'}</span>
            </button>

            <button
              type="button"
              className="pd-nike-btn-buy"
              onClick={async () => {
                await addToCart(product, quantity, selectedVariation?.id || selectedVariation?.variation_id || product.default_variation_id, true);
                window.scrollTo({ top: 0, behavior: 'instant' });
                navigate('/checkout');
              }}
            >
              <span>Buy Now</span>
            </button>

            {/* Sharing Options */}
            <div className="pd-nike-share-row">
              <button
                type="button"
                className={`pd-nike-share-item pd-nike-wishlist-item ${isInWishlist(product?.id) ? 'is-active' : ''}`}
                onClick={() => product && toggleWishlist(product)}
                title={isInWishlist(product?.id) ? "In Wishlist" : "Add to Wishlist"}
              >
                <Heart size={16} fill={isInWishlist(product?.id) ? "#ef4444" : "none"} color={isInWishlist(product?.id) ? "#ef4444" : "#4b5563"} />
                <span>{isInWishlist(product?.id) ? 'Wishlisted' : 'Wishlist'}</span>
              </button>
              <button
                type="button"
                className="pd-nike-share-item"
                onClick={shareToWhatsApp}
                title="Share on WhatsApp"
              >
                <MessageCircle size={16} />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                className={`pd-nike-share-item ${shareCopied ? 'copied' : ''}`}
                onClick={copyShareLink}
                title="Copy product link"
              >
                {shareCopied ? <Check size={16} /> : <Copy size={16} />}
                <span>{shareCopied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Delivery & Pincode Check (Sleek Nike Card) */}
          <div className="pd-nike-delivery-card">
            <div className="pd-nike-delivery-head">
              <Truck size={18} />
              <span>Delivery & Pincode Availability</span>
            </div>
            <div className="pd-nike-pincode-input-wrap">
              <input
                type="text"
                placeholder="Enter 6-digit PIN code"
                value={pinCode}
                maxLength={6}
                onChange={(e) => {
                  setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (pinError) setPinError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleVerifyPincode();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleVerifyPincode}
                disabled={isCheckingPin || pinCode.length !== 6}
              >
                {isCheckingPin ? '...' : 'Check'}
              </button>
            </div>

            {deliveryInfo && (
              <div className="pd-nike-delivery-success">
                <CheckCircle size={15} color="#16a34a" />
                <span>
                  Deliverable to {deliveryInfo.location ? `${deliveryInfo.location}` : `PIN ${deliveryInfo.pin}`} in {deliveryInfo.timeline}
                </span>
              </div>
            )}
            {pinError && (
              <p className="pd-nike-delivery-error">{pinError}</p>
            )}
            <p className="pd-nike-delivery-perk">
              ✓ Free Standard Shipping on orders of ₹500 or more
            </p>
          </div>

          {/* Nike Signature Collapsible Accordion Sections */}
          <div className="pd-nike-accordion">
            {/* 1. Description */}
            <div className="pd-nike-accordion-item">
              <button
                type="button"
                className="pd-nike-accordion-header"
                onClick={() => toggleAccordion('desc')}
                aria-expanded={openAccordion.desc}
              >
                <span>{t('descriptionLabel') || 'Product Description'}</span>
                {openAccordion.desc ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>
              {openAccordion.desc && (
                <div className="pd-nike-accordion-body">
                  {(translatedDesc || '').split(/\n\n+/).map((para, idx) => (
                    <p key={idx} className="pd-nike-desc-p">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Key Benefits */}
            <div className="pd-nike-accordion-item">
              <button
                type="button"
                className="pd-nike-accordion-header"
                onClick={() => toggleAccordion('benefits')}
                aria-expanded={openAccordion.benefits}
              >
                <span>Key Benefits & Features</span>
                {openAccordion.benefits ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>
              {openAccordion.benefits && (
                <div className="pd-nike-accordion-body">
                  <div className="pd-nike-benefits-list">
                    {calculatedBenefits.map((b, idx) => (
                      <div key={idx} className="pd-nike-benefit-item">
                        <CheckCircle size={16} className="text-emerald" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Ingredients */}
            <div className="pd-nike-accordion-item">
              <button
                type="button"
                className="pd-nike-accordion-header"
                onClick={() => toggleAccordion('ingredients')}
                aria-expanded={openAccordion.ingredients}
              >
                <span>{t('ingredientsLabel') || 'Ingredients'}</span>
                {openAccordion.ingredients ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>
              {openAccordion.ingredients && (
                <div className="pd-nike-accordion-body">
                  {productIngredients && productIngredients.length > 0 ? (
                    <div className="pd-nike-ingredients-tags">
                      {productIngredients.map((item, idx) => (
                        <span key={idx} className="pd-nike-ing-tag">
                          <Leaf size={12} />
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="pd-nike-muted-text">
                      {t('ingredientsNotAvailable') || 'Ingredients information not available'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 4. Directions / How to Use */}
            <div className="pd-nike-accordion-item">
              <button
                type="button"
                className="pd-nike-accordion-header"
                onClick={() => toggleAccordion('directions')}
                aria-expanded={openAccordion.directions}
              >
                <span>{t('directionsLabel') || 'How to Use / Directions'}</span>
                {openAccordion.directions ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>
              {openAccordion.directions && (
                <div className="pd-nike-accordion-body">
                  {productDirections ? (
                    <p className="pd-nike-desc-p">{productDirections}</p>
                  ) : (
                    <p className="pd-nike-muted-text">
                      {t('usageNotAvailable') || 'Usage instructions not available'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 5. Reviews Accordion */}
            <div className="pd-nike-accordion-item" id="nike-accordion-reviews">
              <button
                type="button"
                className="pd-nike-accordion-header"
                onClick={() => toggleAccordion('reviews')}
                aria-expanded={openAccordion.reviews}
              >
                <span>Reviews ({reviews?.length || 0})</span>
                {openAccordion.reviews ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
              </button>
              {openAccordion.reviews && (
                <div className="pd-nike-accordion-body">
                  <div className="pd-nike-reviews-summary">
                    <div className="pd-nike-stars-row">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={18}
                          fill={s <= Math.round(avgRating) ? "#111111" : "transparent"}
                          color="#111111"
                        />
                      ))}
                      <span className="pd-nike-score-text">{avgRating.toFixed(1)} Stars</span>
                    </div>
                    <button
                      type="button"
                      className="pd-nike-write-btn-outline"
                      onClick={() => setShowReviewModal(true)}
                    >
                      Write a Review
                    </button>
                  </div>

                  {reviews && reviews.length > 0 ? (
                    <div className="pd-nike-reviews-cards">
                      {reviews.slice(0, 4).map((r, i) => (
                        <div key={i} className="pd-nike-review-item">
                          <div className="rev-head">
                            <strong>{r.user || r.name || 'Verified Buyer'}</strong>
                            <div className="rev-stars">
                              {[...Array(5)].map((_, si) => (
                                <Star
                                  key={si}
                                  size={12}
                                  fill={si < (r.rating || 5) ? "#111111" : "#e5e5e5"}
                                  color={si < (r.rating || 5) ? "#111111" : "#e5e5e5"}
                                />
                              ))}
                            </div>
                          </div>
                          {r.comment && <p className="rev-comment">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="pd-nike-muted-text">No reviews yet. Be the first to review this product!</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Write Review Modal */}
      {showReviewModal && (
        <div className="pd-review-modal-backdrop" onClick={() => !isSubmittingReview && setShowReviewModal(false)}>
          <div className="pd-review-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pd-review-modal-close"
              onClick={() => setShowReviewModal(false)}
              disabled={isSubmittingReview}
              aria-label="Close review modal"
            >
              ×
            </button>

            <div className="pd-review-modal-header">
              <div className="pd-review-modal-product">
                <img src={mediaItems[0]?.src || product?.image} alt={translatedName} />
                <div>
                  <h3>Write a Customer Review</h3>
                  <p className="pd-review-modal-product-name">{translatedName}</p>
                </div>
              </div>
            </div>

            {reviewSuccessMsg ? (
              <div className="pd-review-success-state">
                <div className="pd-success-icon-wrap">
                  <CheckCircle size={52} color="#16a34a" />
                </div>
                <h4>Thank you for your feedback!</h4>
                <p>Your review has been submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleCustomerReviewSubmit} className="pd-review-form" noValidate>
                {/* Interactive Star Rating */}
                <div className="pd-form-group">
                  <label className="pd-form-label">
                    Your Rating
                  </label>
                  <div className="pd-interactive-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        className="pd-star-btn"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setNewRating(star)}
                        title={`${star} Star`}
                      >
                        <Star
                          size={32}
                          fill={(hoverRating || newRating) >= star ? "#fbbf24" : "transparent"}
                          color={(hoverRating || newRating) >= star ? "#fbbf24" : "#d1d5db"}
                        />
                      </button>
                    ))}
                    <span className="pd-rating-text-label">
                      {{
                        1: '⭐ Poor - Not satisfied',
                        2: '⭐⭐ Fair - Needs improvement',
                        3: '⭐⭐⭐ Good - Met expectations',
                        4: '⭐⭐⭐⭐ Very Good - Satisfied',
                        5: '⭐⭐⭐⭐⭐ Excellent - Loved it!'
                      }[hoverRating || newRating] || 'Select Rating'}
                    </span>
                  </div>
                </div>

                {/* Your Name */}
                <div className="pd-form-group">
                  <label className="pd-form-label">
                    Your Name
                  </label>
                  <input
                    type="text"
                    className="pd-form-input"
                    placeholder="e.g. Karthik, Priya (optional)"
                    value={newReviewerName}
                    onChange={(e) => setNewReviewerName(e.target.value)}
                  />
                </div>

                {/* Review Message */}
                <div className="pd-form-group">
                  <label className="pd-form-label">
                    Your Review / Feedback
                  </label>
                  <textarea
                    className="pd-form-textarea"
                    rows={2}
                    placeholder="Share your genuine experience with this herbal product (optional)"
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                  />
                </div>

                {reviewError && (
                  <p className="pd-review-error-msg">{reviewError}</p>
                )}

                {/* Modal Buttons */}
                <div className="pd-review-modal-actions">
                  <button
                    type="button"
                    className="pd-btn-secondary"
                    onClick={() => setShowReviewModal(false)}
                    disabled={isSubmittingReview}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pd-btn-submit-review"
                    disabled={isSubmittingReview}
                  >
                    {isSubmittingReview ? 'Posting Review...' : 'Post Review'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Customer Reviews Section (Rendered below on the page when reviews exist) */}
      {reviews && reviews.length > 0 && (
        <div id="customer-reviews-section" className="pd-customer-reviews-section" style={{ maxWidth: '1200px', margin: '40px auto 20px', padding: '0 20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              Customer Reviews
            </h3>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>
              Real experiences and feedback from genuine herbal customers
            </p>
          </div>

          <div className="pd-reviews-list-grid">
            {reviews.map((rev) => (
              <div key={rev.id} className="pd-single-review-card">
                <div className="pd-single-review-header">
                  <div className="pd-single-review-avatar" style={{ backgroundColor: rev.color || '#10b981' }}>
                    {rev.initial || (rev.name ? rev.name.charAt(0).toUpperCase() : 'C')}
                  </div>
                  <div className="pd-single-review-info">
                    <div className="pd-single-review-name-row">
                      <span className="pd-single-review-name">{rev.name}</span>
                      <span className="pd-single-review-badge">Verified Buyer</span>
                      {rev.isLocal && (
                        <button
                          type="button"
                          className="pd-delete-review-chip"
                          onClick={() => handleDeleteReview(rev.id)}
                          title="Delete review"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <span className="pd-single-review-date">{rev.date}</span>
                  </div>
                </div>

                <div className="pd-single-review-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      style={{ color: s <= (rev.rating || 5) ? '#fbbf24' : '#d1d5db', fontSize: '1.1rem' }}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <p className="pd-single-review-text">"{rev.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pd-pro-divider" style={{ marginTop: '60px', marginBottom: '20px' }}></div>

      <div className="related-products-section" style={{ maxWidth: '1200px', margin: '40px auto 0' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', fontWeight: 800, marginBottom: 'clamp(20px, 4vw, 40px)', color: '#111827' }}>{t('relatedProducts')}</h2>
        <div className="shop-grid">
          {relatedProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      {isFullscreen && (
        <div className="pd-fullscreen-modal" onClick={() => setIsFullscreen(false)}>
          <button className="pd-fullscreen-close" onClick={() => setIsFullscreen(false)}>×</button>

          <button
            className="pd-fullscreen-prev"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentImgIndex(i => (i > 0 ? i - 1 : mediaItems.length - 1));
            }}
          >
            &#10094;
          </button>

          <div className="pd-fullscreen-content" onClick={e => e.stopPropagation()}>
            <img src={currentMedia?.src} alt="Fullscreen product" className="pd-fullscreen-image" />
          </div>

          <button
            className="pd-fullscreen-next"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentImgIndex(i => (i < mediaItems.length - 1 ? i + 1 : 0));
            }}
          >
            &#10095;
          </button>
        </div>
      )}

      {/* Universal Fixed Bottom Buy Bar (Desktop & Mobile) */}
      <div
        className={`pd-fixed-buy-bar ${showDesktopBuyBar ? 'desktop-visible' : ''}`}
        role="region"
        aria-label="Product purchase action bar"
      >
        <div className="pd-fixed-buy-bar-container">
          {/* Desktop Left: Product thumbnail & clean title */}
          <div className="pd-fixed-bar-product-info">
            <img
              src={mediaItems[0]?.src || product.image}
              alt={translatedName || formatProductDisplayName(product.name)}
              className="pd-fixed-bar-thumb"
            />
            <div className="pd-fixed-bar-meta">
              <span className="pd-fixed-bar-title">{translatedName || formatProductDisplayName(product.name)}</span>
              <span className="pd-fixed-bar-variant">
                {selectedVariation ? formatVariationLabel(selectedVariation, product) : (product.pack_size || formatProductPackSize(product) || 'Standard')}
              </span>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="pd-sticky-price-box">
            <div className="pd-sticky-prices">
              <span className="pd-sticky-active-price">
                {formatCurrency(selectedVariation?.price || product.price)}
              </span>
              {selectedVariation?.originalPrice && (
                <span className="pd-sticky-original-price">{formatCurrency(selectedVariation.originalPrice)}</span>
              )}
            </div>
            <span className="pd-sticky-pack-label mobile-only">
              {selectedVariation ? formatVariationLabel(selectedVariation, product) : (product.pack_size || formatProductPackSize(product) || 'Standard')}
            </span>
          </div>

          {/* Buttons: Add to Cart & Buy Now */}
          <div className="pd-sticky-btn-group">
            <button
              type="button"
              className="pd-sticky-btn pd-sticky-add-btn"
              onClick={() => addToCart(product, quantity, selectedVariation?.id || selectedVariation?.variation_id || product.default_variation_id)}
              aria-label="Add to Cart"
            >
              <ShoppingCart size={18} strokeWidth={2.4} aria-hidden="true" />
              <span>{t('addToCart') || 'Add to Cart'}</span>
            </button>
            <button
              type="button"
              className="pd-sticky-btn pd-sticky-buy-btn"
              onClick={async () => {
                await addToCart(product, quantity, selectedVariation?.id || selectedVariation?.variation_id || product.default_variation_id, true);
                window.scrollTo({ top: 0, behavior: 'instant' });
                navigate('/checkout');
              }}
              aria-label="Buy Now"
            >
              <span>Buy Now</span>
            </button>
            <button
              type="button"
              className="pd-sticky-btn pd-sticky-wa-btn"
              onClick={shareToWhatsApp}
              title="Share on WhatsApp"
              aria-label="Share on WhatsApp"
            >
              <MessageCircle size={18} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
