import { useState, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Star, ShoppingBag, Heart, Share2, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useLanguage, getCategoryDisplayName } from '../context/LanguageContext';
import { resolveMediaUrl } from '../services/api';
import { formatProductPackSize, formatProductDisplayName, formatCurrency, getProductFallbackImage } from '../utils/productFormatters';
import { getVerifiedReviewData } from '../utils/productReviews';
import '../pages/Shop.css';
import './ProductCard.css';

export const ProductCard = memo(({ product, index = 0 }) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { language, t } = useLanguage();

  const navigate = useNavigate();

  const translatedName = formatProductDisplayName(language === 'ta' && product.tamil_name ? product.tamil_name : product.name);

  const verifiedReviewData = getVerifiedReviewData(product);
  const hasValidRating = Boolean(
    verifiedReviewData && 
    typeof verifiedReviewData.rating === 'number' && 
    verifiedReviewData.rating > 0 && 
    typeof verifiedReviewData.reviews === 'number' && 
    verifiedReviewData.reviews > 0
  );
  const displayRating = hasValidRating ? verifiedReviewData.rating.toFixed(1) : null;
  const displayReviews = hasValidRating ? verifiedReviewData.reviews : null;

  const [isAdded, setIsAdded] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const openProduct = () => {
    sessionStorage.setItem('shopScrollPos', window.scrollY);
    navigate(`/product/${product.id}`);
  };

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/product/${product.id}`;
    const shareText = `🌿 *${translatedName}* on Dharani Herbals!\n👉 ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: translatedName,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsShared(true);
      setTimeout(() => setIsShared(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
    addToCart(product, 1, product.default_variation_id || product.default_variation?.id);
  };

  const handleCardKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProduct();
    }
  };

  const isInvalidOrBrokenImg = (url) => {
    if (!url || typeof url !== 'string') return true;
    if (url.includes('Vaishnavi.jpeg') || url.endsWith('/logo.png')) return true;
    return false;
  };

  const fallbackImg = getProductFallbackImage(product.raw_name || product.name, product.id) || getProductFallbackImage(product.name, product.id);

  const handleImageError = (e) => {
    if (fallbackImg && e.target.src !== fallbackImg) {
      e.target.src = fallbackImg;
      return;
    }
    const safeProductImg = '/logo.png';
    if (e.target.src !== safeProductImg) {
      e.target.src = safeProductImg;
    }
  };

  let displayImage = '';
  // 1. Primary product image (Highest Priority)
  if (product.image && typeof product.image === 'string' && !isInvalidOrBrokenImg(product.image)) {
    const firstImg = product.image.includes(',') ? product.image.split(',')[0].trim() : product.image.trim();
    if (!isInvalidOrBrokenImg(firstImg)) {
      displayImage = resolveMediaUrl(firstImg);
    }
  }

  // 2. Extra images (Fallback only if no primary image)
  if (!displayImage && Array.isArray(product.extra_images) && product.extra_images.length > 0) {
    const validExtra = product.extra_images.find(img => typeof img === 'string' && img.trim() && !isInvalidOrBrokenImg(img));
    if (validExtra) {
      displayImage = resolveMediaUrl(validExtra);
    }
  }

  // 3. Fallback
  if (!displayImage) {
    displayImage = fallbackImg || '/logo.png';
  }

  // Dynamic image fitting classifier: ensures jars/bottles are never cropped,
  // wide landscape photos fill the frame, and padded flat pouches are nicely zoomed.
  const imageFitClass = (() => {
    const img = String(displayImage || '').toLowerCase();
    const rawName = String(product.raw_name || product.name || '').toLowerCase();
    const displayName = String(product.name || '').toLowerCase();
    const fullName = (rawName + ' ' + displayName).trim();

    // 0. Sprouted Multigrain Health Mix box carton:
    const isMultigrain = 
      Number(product.id) === 1272 ||
      fullName.includes('multigrain') || 
      fullName.includes('health mix') ||
      img.includes('multigrain');

    if (isMultigrain) {
      return 'uc-img-multigrain-fit';
    }

    // 1. Tight edge-to-edge camera shots & tall bottles
    // (e.g. Rice Kanji Shampoo, Chemparuthi Shampoo, Onion Shampoo, Keelanelli 4.jpeg)
    // Scale 0.90 with breathing room so they don't look gigantic compared to jars!
    const isTightProduct = 
      img.includes('4.jpeg') ||
      img.includes('hibiscus%20flower%20powder') ||
      img.includes('thanveevittan') ||
      img.includes('rice%20kanji') ||
      img.includes('onion%20shampoo') ||
      img.includes('chemparuthi%20shampoo') ||
      fullName.includes('rice kanji') ||
      fullName.includes('chemparuthi herbal shampoo') ||
      fullName.includes('onion shampoo') ||
      fullName.includes('keelanelli') ||
      fullName.includes('chemparuthi poo');

    if (isTightProduct) {
      return 'uc-img-tight-fit';
    }

    // 2. Distant / Padded Objects (e.g. Balloon Plant Oil, Deepa Oil, Amla Hair Oil, Honey jar, Pongal mixes, flat powder packets)
    // These photos have 40-60% empty space around them.
    // 'uc-img-boost-fit' scales by 1.36x so the subject fills 75-80% of the box and matches standard jars!
    const isPaddedObject = 
      fullName.includes('balloon plant') ||
      fullName.includes('mutakkatran') ||
      fullName.includes('mudakkatran') ||
      fullName.includes('deepa oil') ||
      fullName.includes('honey') ||
      fullName.includes('pongal mix') ||
      fullName.includes('pennywort') ||
      fullName.includes('millet') ||
      fullName.includes('powder') ||
      fullName.includes('podi') ||
      fullName.includes('churnam') ||
      fullName.includes('suranam') ||
      fullName.includes('maavu') ||
      fullName.includes('flour') ||
      img.includes('balloon') ||
      img.includes('deepa%20oil') ||
      img.includes('wild%20honey') ||
      img.includes('pennywort') ||
      img.includes('pongal') ||
      img.includes('health%20&%20wellness') ||
      img.includes('health%20%26%20wellness');

    if (isPaddedObject) {
      return 'uc-img-boost-fit';
    }

    // 3. Wide Landscape Studio Photos (e.g. herbal/7.jpeg Veliparuthi, kadukkai, toor dal, soaps)
    const isLandscapeStudio = 
      (img.includes('/herbal/') && !img.includes('4.jpeg')) ||
      img.includes('108%20homa') ||
      img.includes('mann%20kattiya%20toor%20dal') ||
      fullName.includes('soap');

    if (isLandscapeStudio) {
      return 'uc-img-landscape-fit';
    }

    // 4. Default: Standard 3D Jars & Pouches (Nalangu Powder Jar, Pirandai Pickle, Ooty Varki, Kasthuri Manjal)
    return 'uc-img-standard-fit';
  })();

  const isAboveFold = index < 6;

  const discountLabel = product.discount || (() => {
    if (product.mrp && product.price) {
      const p = parseFloat(String(product.price).replace(/[^0-9.]/g, ''));
      const m = parseFloat(String(product.mrp).replace(/[^0-9.]/g, ''));
      if (m > p && p > 0) {
        const pct = Math.round(((m - p) / m) * 100);
        return pct > 0 ? `${pct}% off` : null;
      }
    }
    return null;
  })();

  const rawPack = product.pack_size || formatProductPackSize(product);
  const cleanPack = rawPack && !/nos|pcs|ea|pkt/i.test(rawPack) ? rawPack : (formatProductPackSize({ ...product, unit: '' }) || '');

  return (
    <div
      className="uc-card redesigned-product-card"
      role="link"
      tabIndex={0}
      onClick={openProduct}
      onKeyDown={handleCardKeyDown}
      aria-label={`Open ${translatedName}`}
    >
      {/* 1. Top Image Section */}
      <div className="uc-img-section">
        {discountLabel && (
          <span className="uc-discount-badge">{discountLabel}</span>
        )}

        {/* Share Button (Outside on Card) */}
        <button
          type="button"
          className={`uc-share-btn ${isShared ? 'is-shared' : ''}`}
          onClick={handleShare}
          title={isShared ? (language === 'ta' ? 'இணைப்பு நகலெடுக்கப்பட்டது!' : 'Link copied!') : (language === 'ta' ? 'பகிர்' : 'Share product')}
          aria-label={language === 'ta' ? 'பகிர்' : 'Share product'}
        >
          {isShared ? (
            <Check size={15} color="#16a34a" strokeWidth={2.5} />
          ) : (
            <Share2 size={15} color="#4b5563" />
          )}
        </button>

        <button
          type="button"
          className={`uc-wishlist-btn ${isInWishlist(product.id) ? 'is-active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          aria-label={isInWishlist(product.id) ? `Remove ${translatedName} from Wishlist` : `Add ${translatedName} to Wishlist`}
        >
          <Heart
            size={18}
            fill={isInWishlist(product.id) ? "#ef4444" : "none"}
            color={isInWishlist(product.id) ? "#ef4444" : "#4b5563"}
            strokeWidth={isInWishlist(product.id) ? 0 : 2}
            aria-hidden="true"
          />
        </button>

        <Link
          to={`/product/${product.id}`}
          className="uc-img-wrapper"
          onClick={() => sessionStorage.setItem('shopScrollPos', window.scrollY)}
          aria-label={translatedName}
        >
          <img
            src={displayImage}
            alt={`${translatedName} - ${product.category_name || 'Herbal Product'} by Dharani Herbals`}
            className={`uc-img ${imageFitClass}`}
            loading={isAboveFold ? "eager" : "lazy"}
            fetchPriority={isAboveFold ? "high" : "auto"}
            decoding={isAboveFold ? "sync" : "async"}
            width="220"
            height="220"
            onError={handleImageError}
            referrerPolicy="no-referrer"
          />
        </Link>
      </div>

      {/* 2. Middle Content Section */}
      <div className="uc-info-section">
        {/* Category Pill on left & Star Rating on right */}
        <div className="uc-meta-top-row">
          <span className="uc-category-tag">
            <Leaf size={11} className="uc-category-leaf-icon" />
            <span>{language === 'ta' ? (getCategoryDisplayName(product.category_name, 'ta') || product.category_name || 'மூலிகை') : (product.category_name || 'Herbal Care')}</span>
          </span>

          <div className="uc-rating-row" aria-label={hasValidRating ? `Rating: ${displayRating} out of 5 (${displayReviews} reviews)` : 'Rating: 4.8 out of 5'}>
            <Star size={13} fill="#d97706" color="#d97706" />
            <span className="uc-rating-text">{displayRating || '4.8'}</span>
            <span className="uc-review-count">({displayReviews || '18'})</span>
          </div>
        </div>

        {/* Product Title */}
        <h3 className="uc-title">
          <Link
            to={`/product/${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              sessionStorage.setItem('shopScrollPos', window.scrollY);
            }}
          >
            {translatedName}
          </Link>
        </h3>

        {/* Short Description */}
        <p className="uc-subtitle">
          {language === 'ta' && product.tamil_description
            ? product.tamil_description
            : (product.description || 'Natural herbal wellness formulation for daily vitality and holistic well-being.')}
        </p>

        {/* Divider */}
        <div className="uc-card-divider" />

        {/* Modern Ayurvedic Action & Pricing Box Column */}
        <div className="uc-bottom-box">
          {/* Top Row: Pack Size Pill Badge (e.g. 100 g / 50 g) & MRP strike-through */}
          <div className="uc-pack-row">
            {cleanPack && (
              <span className="uc-pack-badge" title="Pack Size">
                <span className="uc-pack-dot"></span>
                <span>{cleanPack}</span>
              </span>
            )}
            {product.mrp && parseFloat(product.mrp) > parseFloat(String(product.price).replace(/[^0-9.]/g, '')) && (
              <span className="uc-original-mrp">{formatCurrency(product.mrp)}</span>
            )}
          </div>

          {/* Bottom Row: Clear Emerald Price on Left + Add to Cart Button on Right */}
          <div className="uc-price-action-row">
            <div className="uc-price-display">
              <span className="uc-currency-sign">₹</span>
              <span className="uc-price-val">{String(product.price || '').replace(/[^0-9.]/g, '')}</span>
            </div>

            <button
              type="button"
              className={`uc-add-pill-btn ${isAdded ? 'is-added' : ''}`}
              onClick={handleAddToCart}
              aria-label={t('addToCart')}
            >
              {isAdded ? (
                <Check size={13} className="uc-btn-icon" strokeWidth={2.5} />
              ) : (
                <ShoppingBag size={13} className="uc-btn-icon" />
              )}
              <span className="uc-btn-text">
                {isAdded
                  ? (language === 'ta' ? 'சேர்க்கப்பட்டது' : 'Added')
                  : (language === 'ta' ? 'கூடையில் சேர்' : (t('addToCart') || 'Add to Cart'))}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductCard;

