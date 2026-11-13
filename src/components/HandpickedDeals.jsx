import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL, NEW_PRODUCTS_API_URL, resolveMediaUrl } from '../services/api';
import { formatProductDisplayName, formatProductPackSize, formatCurrency, getProductFallbackImage } from '../utils/productFormatters';
import ProductCard from './ProductCard';
import './HandpickedDeals.css';

export default function HandpickedDeals() {
  const { products, getProductById } = useProducts();
  const { t } = useLanguage();
  const [newProductsList, setNewProductsList] = useState([]);
  const [loadingNew, setLoadingNew] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Fetch dynamically from server endpoint /herbal/new-products/ with robust fallbacks
    const fetchNewProducts = async () => {
      const endpoints = [
        NEW_PRODUCTS_API_URL || `${API_BASE_URL}/new-products/`,
        '/api/new-products/',
        'http://179.197.251.47:30080/herbal/new-products/'
      ];

      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            }
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && (contentType.includes('application/json') || contentType.includes('text/json'))) {
            const json = await res.json();
            // Backend returns: { status: true, count: 0, data: [] } or a raw list
            const rawList = Array.isArray(json) ? json : (json.data || json.results || []);
            if (isMounted) {
              if (rawList && rawList.length > 0) {
                setNewProductsList(rawList);
              }
              setLoadingNew(false);
            }
            // Once we get a successful HTTP 200 JSON response, we don't need to try next endpoints
            return;
          }
        } catch (e) {
          // try next fallback endpoint if network/proxy failure
        }
      }

      if (isMounted) {
        setLoadingNew(false);
      }
    };

    fetchNewProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const dealProducts = useMemo(() => {
    // 1. If dynamic products arrived from new-products API:
    if (newProductsList && newProductsList.length > 0) {
      return newProductsList.map((item) => {
        // If product already exists in main catalog with full enriched data, merge it!
        const existing = (getProductById ? getProductById(item.id) : null) || (products || []).find(p => p.id === item.id);
        if (existing) {
          const itemImg = item.image ? resolveMediaUrl(item.image) : null;
          return {
            ...existing,
            image: itemImg || existing.image || getProductFallbackImage(item.name, item.id),
            badge: existing.badge || 'NEW',
            badgeColor: existing.badgeColor || 'green'
          };
        }

        const displayName = formatProductDisplayName(item.name);
        const displayTamilName = formatProductDisplayName(item.tamil_name || item.name);
        const priceNum = parseFloat(item.customer_price || item.price || item.mrp || 0);
        const mrpNum = parseFloat(item.mrp || item.price || 0);

        return {
          id: item.id,
          brand: item.brand || 'Dharani Herbals',
          brand_id: item.brand_id || null,
          name: displayName,
          raw_name: item.name,
          tamil_name: displayTamilName,
          subtitle: item.description ? (item.description.length > 70 ? item.description.substring(0, 70) + '...' : item.description) : 'Pure authentic South Indian botanical formulation.',
          price: formatCurrency(priceNum),
          originalPrice: mrpNum > priceNum ? formatCurrency(mrpNum) : '',
          discount: mrpNum > priceNum ? `${Math.round(((mrpNum - priceNum) / mrpNum) * 100)}% OFF` : '',
          rating: 5.0,
          reviews: 1,
          badge: 'NEW',
          badgeColor: 'green',
          image: resolveMediaUrl(item.image) || '/logo.png',
          category_name: item.category_name || (item.category === 7 ? 'Health & Wellness' : 'Herbal Care'),
          description: item.description || 'Pure authentic South Indian botanical formulation for natural health and beauty.',
          pack_size: formatProductPackSize(item) || '50g',
          variations: []
        };
      });
    }

    // 2. Fallback: dynamically pick products from catalog with is_new or newest additions
    if (products && products.length > 0) {
      const newItems = products.filter(p => p.is_new || p.badge === 'NEW');
      if (newItems.length > 0) return newItems.slice(0, 8);

      // If backend has 0 items marked as new, dynamically show latest catalog additions
      const newestCatalog = [...products]
        .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
        .slice(0, 8)
        .map(p => ({
          ...p,
          badge: p.badge || 'NEW',
          badgeColor: p.badgeColor || 'green'
        }));
      return newestCatalog;
    }

    return [];
  }, [newProductsList, products, getProductById]);

  if (!loadingNew && dealProducts.length === 0) {
    return null;
  }

  return (
    <div className="deals-container">
      <div className="reveal bento-header" style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.2) 0%, rgba(34,197,94,0.1) 100%)', borderColor: 'rgba(74,222,128,0.3)' }}>
        <div className="bento-header-blob right"></div>
        <div className="bento-title-col">
          <h2 className="bento-title-text">
            <div>{t('trendingProducts')}</div>
          </h2>
        </div>
        <div className="bento-desc-col">
          <p className="bento-desc-text">
            {t('trendingDesc')}
          </p>
        </div>
      </div>

      <div className="shop-grid deals-grid reveal">
        {dealProducts.map((product, idx) => (
          <ProductCard key={product.id} product={product} index={idx} />
        ))}
      </div>
    </div>
  );
}
