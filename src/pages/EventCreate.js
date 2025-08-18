// src/pages/EventCreate.js
import React, { useState, useEffect, useRef } from 'react';
import MorePrd from './MorePrd';
import {
  Card,
  Steps,
  Upload,
  Input,
  Button,
  Segmented,
  Space,
  Modal,
  Form,
  Select,
  message,
  Tag,
  Grid,
  Alert,
  Checkbox,
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  LinkOutlined,
  TagOutlined,
  BlockOutlined,
  YoutubeOutlined,
  FontSizeOutlined,
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../axios';
import './EventCreate.css';
import sha256 from 'crypto-js/sha256';
import encHex from 'crypto-js/enc-hex';

const { Step } = Steps;
const { useBreakpoint } = Grid;

/** ✅ mallId/호스트 고정 */
const MALL_ID = 'yogibo';
const API_HOST = 'https://port-0-ychat-lzgmwhc4d9883c97.sel4.cloudtype.app';
const API_PREFIX = `${API_HOST}/api/${MALL_ID}`;

// YouTube id 파서 (기존)
function getYouTubeId(input) {
  if (!input) return null;
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input.trim());
    const host = url.hostname.replace('www.', '');
    if (host === 'youtu.be') return url.pathname.slice(1);
    if (host.includes('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const m = url.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch (_) {}
  return null;
}

// buildYouTubeSrc: iframe fallback URL 생성 (남겨둠)
const buildYouTubeSrc = (id, autoplay = false, loop = false) => {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: autoplay ? '1' : '0',
    playsinline: '1',
    rel: 0,
    modestbranding: 1,
    enablejsapi: 1,
  });
  if (loop) {
    params.set('loop', '1');
    params.set('playlist', id);
  }
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
};

// ----------------------
// YouTubeAuto 컴포넌트 (IFrame API 사용 — autoplay 시도, 실패하면 오버레이)
// ----------------------
function YouTubeAuto({ videoId, autoplay = false, loop = false, aspectW = 16, aspectH = 9 }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    let mounted = true;

    // onReady handler 정의
    const onAPIReady = () => {
      if (!mounted) return;
      // destroy 기존 플레이어 있으면 정리
      try {
        if (playerRef.current && playerRef.current.destroy) {
          playerRef.current.destroy();
        }
      } catch (e) {}

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          loop: loop ? 1 : 0,
          playlist: loop ? videoId : undefined,
        },
        events: {
          onReady: (e) => {
            if (!mounted) return;
            try {
              // autoplay 시도: mute -> play
              if (autoplay) {
                e.target.mute?.();
                const playPromise = e.target.playVideo?.();
                // play가 거부될 수 있으므로 타이머로 상태 체크
                setTimeout(() => {
                  try {
                    const state = e.target.getPlayerState?.();
                    if (typeof state === 'number' && state !== 1) {
                      setNeedsInteraction(true);
                    }
                  } catch (err) {
                    setNeedsInteraction(true);
                  }
                }, 700);
              }
              // iframe allow 속성 추가 (안정성 위해)
              try {
                const iframe = playerRef.current.getIframe?.();
                if (iframe) {
                  iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
                }
              } catch (err) {}
            } catch (err) {
              setNeedsInteraction(true);
            }
          },
          onError: () => {
            if (mounted) setNeedsInteraction(true);
          },
        },
      });
    };

    // 안전한 API 로드: 여러 인스턴스에서 충돌 없도록 큐 사용
    if (window.YT && window.YT.Player) {
      onAPIReady();
    } else {
      // 스크립트가 이미 추가되어 있는지 확인
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      // 콜백 큐 초기화
      if (!window._ytApiReadyQueue) {
        window._ytApiReadyQueue = [];
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (typeof prev === 'function') prev();
          window._ytApiReadyQueue.forEach(cb => {
            try { cb(); } catch (_e) {}
          });
          window._ytApiReadyQueue = [];
        };
      }
      window._ytApiReadyQueue.push(onAPIReady);
    }

    return () => {
      mounted = false;
      try {
        playerRef.current?.destroy?.();
      } catch (_) {}
    };
  }, [videoId, autoplay, loop]);

  const requestPlayByUser = () => {
    try {
      if (playerRef.current) {
        // 사용자 터치로 재생 시에는 언뮤트 후 플레이 (원하면 뮤트 유지)
        try { playerRef.current.unMute?.(); } catch (_) {}
        try { playerRef.current.playVideo?.(); } catch (_) {}
        setNeedsInteraction(false);
      } else {
        setNeedsInteraction(true);
      }
    } catch (e) {
      setNeedsInteraction(true);
    }
  };

  return (
    <div style={{ width: '100%', position: 'relative', aspectRatio: `${aspectW} / ${aspectH}` }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {needsInteraction && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.25), rgba(0,0,0,0.25))'
        }}>
          <button onClick={requestPlayByUser} style={{ padding: '10px 16px', fontSize: 16, borderRadius: 6 }}>
            ▶ 재생
          </button>
        </div>
      )}
    </div>
  );
}

// <------------------- 기존 EventCreate 컴포넌트 시작 ------------------->
export default function EventCreate() {
  const navigate = useNavigate();
  const { id: _unused } = useParams();

  /** ✅ 다른 컴포넌트(예: MorePrd)가 localStorage에서 mallId를 읽는 경우를 위해 강제로 저장 */
  useEffect(() => {
    localStorage.setItem('mallId', MALL_ID);
  }, []);

  const [msgApi, msgCtx] = message.useMessage();
  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  // 드래그 중 클릭 무시용
  const draggingRef = useRef(false);
  const getItemStyle = (isDragging, draggableStyle) => ({
    userSelect: 'none',
    transition: isDragging
      ? undefined
      : 'transform 200ms cubic-bezier(0.2,0,0,1), opacity 200ms',
    boxShadow: isDragging ? '0 6px 12px rgba(0,0,0,0.15)' : 'none',
    zIndex: isDragging ? 2 : 1,
    ...draggableStyle,
  });

  // wizard
  const [current, setCurrent] = useState(0);
  const titleRef = useRef(null);
  useEffect(() => {
    if (current === 0) setTimeout(() => titleRef.current?.focus(), 0);
  }, [current]);
  const next = () => {
    if (current === 0) {
      if (!title.trim()) setTitle('제목없음');
      setCurrent(1);
    } else if (current === 1 && blocks.length === 0) {
      msgApi.warning('이미지를 추가하세요.');
    } else if (current === 2) {
      if (!registerMode) msgApi.warning('상품 등록 방식을 선택하세요.');
      else if (registerMode === 'category') {
        if (!gridSize) msgApi.warning('그리드 사이즈를 선택해주세요.');
        else if (!layoutType) msgApi.warning('상품 노출 방식을 선택해주세요.');
        else if (layoutType === 'single' && !singleRoot)
          msgApi.warning('상품 분류(대분류)를 선택하세요.');
        else if (layoutType === 'tabs' && tabs.length < 2)
          msgApi.warning('탭을 두 개 이상 설정하세요.');
        else setCurrent(3);
      } else {
        setCurrent(3);
      }
    } else {
      setCurrent(c => c + 1);
    }
  };
  const prev = () => setCurrent(c => c - 1);

  // 제목
  const [title, setTitle] = useState('');

  // 블록들 (image / video / text)
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // 전체보기 토글
  const [showAllPreview, setShowAllPreview] = useState(false);

  // 업로드
  const imgRef = useRef(null);
  const uploadProps = {
    accept: 'image/*',
    multiple: true,
    showUploadList: false,
    beforeUpload: file => {
      const maxSizeMB = 10;
      if (file.size / 1024 / 1024 > maxSizeMB) {
        msgApi.error(`이미지 크기는 ${maxSizeMB}MB 이하여야 합니다.`);
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    customRequest: ({ file, onSuccess }) => {
      const reader = new FileReader();
      reader.onload = e => {
        const src = e.target.result;
        const hash = sha256(src).toString(encHex);
        if (blocks.some(b => b.hash && b.hash === hash)) {
          msgApi.warning('같은 이미지는 한 번만 업로드할 수 있습니다.');
          return;
        }
        const id = Date.now().toString() + Math.random();
        setBlocks(prev => {
          const next = [...prev, { id, type: 'image', src, file, hash, regions: [] }];
          setSelectedId(id);
          // 상세 편집 모드로
          setShowAllPreview(false);
          return next;
        });
        onSuccess('ok');
      };
      reader.readAsDataURL(file);
    },
  };

  // 드래그 정렬
  const onDragEnd = result => {
    if (!result.destination) return;
    const a = Array.from(blocks);
    const [m] = a.splice(result.source.index, 1);
    a.splice(result.destination.index, 0, m);
    setBlocks(a);
    requestAnimationFrame(() => {
      draggingRef.current = false;
    });
  };

  // 매핑
  const [addingMode, setAddingMode] = useState(false);
  const [addType, setAddType] = useState(null); // 'link' | 'coupon'
  const [pendingRegion, setPendingRegion] = useState(null);
  const [dragStartPos, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapForm] = Form.useForm();

  const selectedBlock = blocks.find(b => b.id === selectedId);

  const onMouseDown = e => {
    if (!imgRef.current) return;
    const { left, top } = imgRef.current.getBoundingClientRect();
    setDragStart({ x: e.clientX - left, y: e.clientY - top });
    setDragCurrent({ x: e.clientX - left, y: e.clientY - top });
  };
  const onMouseMove = e => {
    if (!dragStartPos) return;
    const { left, top } = imgRef.current.getBoundingClientRect();
    setDragCurrent({ x: e.clientX - left, y: e.clientY - top });
  };
  const onMouseUp = () => {
    if (!dragStartPos) {
      setDragStart(null);
      return;
    }
    const { clientWidth: W, clientHeight: H } = imgRef.current;
    const x = Math.min(dragStartPos.x, dragCurrent.x);
    const y = Math.min(dragStartPos.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStartPos.x);
    const h = Math.abs(dragCurrent.y - dragStartPos.y);
    const region = {
      id: Date.now().toString(),
      xRatio: x / W,
      yRatio: y / H,
      wRatio: w / W,
      hRatio: h / H,
    };
    setPendingRegion(region);
    setMapModalVisible(true);
    setDragStart(null);
    setDragCurrent(null);
  };

  const saveRegion = () => {
    if (!pendingRegion) return;
    const vals = mapForm.getFieldsValue();
    const updated = { ...pendingRegion };
    if (addType === 'link') {
      let href = (vals.href || '').trim();
      if (!href) return msgApi.error('URL을 입력하세요.');
      if (!/^https?:\/\//.test(href)) href = 'https://' + href;
      updated.href = href;
      delete updated.coupon;
    } else {
      const coupon = (vals.coupon || []).join(',');
      if (!coupon) return msgApi.error('쿠폰을 선택하거나 입력하세요.');
      updated.coupon = coupon;
      delete updated.href;
    }
    setBlocks(prev =>
      prev.map(b =>
        b.id === selectedId && b.type === 'image'
          ? { ...b, regions: [...(b.regions || []), updated] }
          : b
      )
    );
    setMapModalVisible(false);
    setPendingRegion(null);
    setAddingMode(false);
    setAddType(null);
    mapForm.resetFields();
  };

  // 영역 편집/삭제
  const [editingRegion, setEditingRegion] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  const openEditRegion = r => {
    setEditingRegion(r);
    setEditModalVisible(true);
    if (r.coupon) editForm.setFieldsValue({ coupon: r.coupon.split(',') });
    else editForm.setFieldsValue({ href: r.href });
  };
  const applyEditRegion = () => {
    const vals = editForm.getFieldsValue();
    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== selectedId || b.type !== 'image') return b;
        const regions = (b.regions || []).map(r => {
          if (r.id !== editingRegion.id) return r;
          if (r.coupon != null) {
            const coupon = (vals.coupon || []).join(',');
            return { ...r, coupon, href: undefined };
          } else {
            let href = (vals.href || '').trim();
            if (!/^https?:\/\//.test(href)) href = 'https://' + href;
            return { ...r, href, coupon: undefined };
          }
        });
        return { ...b, regions };
      })
    );
    setEditModalVisible(false);
    setEditingRegion(null);
  };
  const deleteRegion = () => {
    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== selectedId || b.type !== 'image') return b;
        const regions = (b.regions || []).filter(r => r.id !== editingRegion.id);
        return { ...b, regions };
      })
    );
    setEditModalVisible(false);
    setEditingRegion(null);
  };

  // 카테고리/레이아웃
  const [allCats, setAllCats] = useState([]);
  useEffect(() => {
    api
      .get(`${API_PREFIX}/categories/all`)
      .then(res => setAllCats(res.data))
      .catch(() => msgApi.error('카테고리 불러오기 실패'));
  }, [msgApi]);

  const [singleRoot, setSingleRoot] = useState(null);
  const [singleSub, setSingleSub] = useState(null);
  const [gridSize, setGridSize] = useState(2);
  const [layoutType, setLayoutType] = useState(null);

  const roots = allCats.filter(c => c.category_depth === 1);
  const subs = allCats.filter(c => c.category_depth === 2 && String(c.parent_category_no) === singleRoot);

  // 등록 방식
  const [registerMode, setRegisterMode] = useState('category');
  const [directProducts, setDirectProducts] = useState([]);
  const [tabDirectProducts, setTabDirectProducts] = useState({});
  const [initialSelected, setInitialSelected] = useState([]);

  // 탭
  const [tabs, setTabs] = useState([
    { title: '', root: null, sub: null },
    { title: '', root: null, sub: null },
  ]);
  const [activeColor, setActiveColor] = useState('#fe6326');
  const addTab = () => {
    if (tabs.length >= 4) return;
    setTabs(ts => [...ts, { title: '', root: null, sub: null }]);
  };
  const updateTab = (i, key, val) => {
    setTabs(ts => {
      const a = [...ts];
      a[i] = { ...a[i], [key]: val, ...(key === 'root' ? { sub: null } : {}) };
      return a;
    });
  };
  // removeTab : 최소 2개는 유지. 삭제 시 tabDirectProducts 재정렬(인덱스 shift)
  const removeTab = (index) => {
    setTabs(prevTabs => {
      if (prevTabs.length <= 2) return prevTabs; // 최소 2개 유지
      const nextTabs = prevTabs.filter((_, i) => i !== index);
      return nextTabs;
    });
    // shift tabDirectProducts keys
    setTabDirectProducts(prev => {
      const next = {};
      const keys = Object.keys(prev).map(k => Number(k)).filter(k => !Number.isNaN(k)).sort((a,b)=>a-b);
      keys.forEach(k => {
        if (k < index) next[k] = prev[k];
        else if (k > index) next[k-1] = prev[k];
      });
      return next;
    });
  };

  // 쿠폰 목록
  const [couponOptions, setCouponOptions] = useState([]);
  useEffect(() => {
    api
      .get(`${API_PREFIX}/coupons`)
      .then(res =>
        setCouponOptions(
          res.data.map(c => ({
            value: c.coupon_no,
            label: `${c.coupon_name} (${c.benefit_percentage}%)`,
          }))
        )
      )
      .catch(() => msgApi.error('쿠폰 불러오기 실패'));
  }, [msgApi]);

  const tagRender = ({ label, closable, onClose }) => (
    <Tag closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
      {String(label).length > 6 ? String(label).slice(0, 6) + '…' : label}
    </Tag>
  );

  // MorePrd 모달
  const [morePrdVisible, setMorePrdVisible] = useState(false);
  const [morePrdTarget, setMorePrdTarget] = useState('direct'); // 'direct' | 'tab'
  const [morePrdTabIndex, setMorePrdTabIndex] = useState(0);
  const openMorePrd = (target, tabIndex = 0) => {
    setMorePrdTarget(target);
    setInitialSelected(
      target === 'direct'
        ? directProducts.map(p => p.product_no)
        : (tabDirectProducts[tabIndex] || []).map(p => p.product_no)
    );
    setMorePrdTabIndex(tabIndex);
    setMorePrdVisible(true);
  };

  // 유튜브 모달
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoForm] = Form.useForm();

  // 텍스트 모달
  const [textModalVisible, setTextModalVisible] = useState(false);
  // ---- FIX: Form.useForm() must be called at top level of component
  const [textForm] = Form.useForm();

  const openCreateText = () => {
    // 이미지가 하나도 없으면 제한
    const hasImage = blocks.some(b => b.type === 'image');
    if (!hasImage) {
      msgApi.info('이미지 추가 후 이용 가능');
      return;
    }
    setSelectedId(null);
    textForm.resetFields();
    setTextModalVisible(true);
    setShowAllPreview(false);
  };

  const openEditText = block => {
    textForm.setFieldsValue({
      text: block.text || '',
      fontSize: block.style?.fontSize || 18,
      fontWeight: block.style?.fontWeight || 'normal',
      color: block.style?.color || '#333333',
      align: block.style?.align || 'center',
      mt: block.style?.mt ?? 16,
      mb: block.style?.mb ?? 16,
    });
    setTextModalVisible(true);
  };

  const submitText = () => {
    const { text, fontSize = 18, fontWeight = 'normal', color = '#333333', align = 'center', mt = 16, mb = 16 } =
      textForm.getFieldsValue();
    if (!text || !String(text).trim()) {
      msgApi.warning('문구를 입력하세요.');
      return;
    }
    const selectedBlock = blocks.find(b => b.id === selectedId);
    if (selectedBlock?.type === 'text') {
      setBlocks(prev =>
        prev.map(b =>
          b.id === selectedBlock.id
            ? { ...b, text, style: { fontSize: Number(fontSize), fontWeight, color, align, mt: Number(mt), mb: Number(mb) } }
            : b
        )
      );
    } else {
      const id = Date.now().toString() + Math.random();
      setBlocks(prev => [
        ...prev,
        {
          id,
          type: 'text',
          text,
          style: { fontSize: Number(fontSize), fontWeight, color, align, mt: Number(mt), mb: Number(mb) },
        },
      ]);
      setSelectedId(id);
    }
    setTextModalVisible(false);
  };

  // 등록
  const [submitting, setSubmitting] = useState(false);

  // 안전한 registerMode 변경기: 'none' 선택 시 관련 상태 초기화
  const handleRegisterModeChange = (val) => {
    setRegisterMode(val);
    if (val === 'none') {
      // clear product-related state and layout choices so nothing remains visible/used
      setLayoutType(null);
      setDirectProducts([]);
      setTabDirectProducts({});
      setTabs([{ title: '', root: null, sub: null }, { title: '', root: null, sub: null }]);
      setSingleRoot(null);
      setSingleSub(null);
      setActiveColor('#fe6326');
    } else {
      // if switching back to category/direct, ensure layoutType has a sane default
      if (!layoutType) setLayoutType('single');
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 이미지 업로드 (백엔드가 FTP로 업로드 처리하는 /uploads/image 사용)
      const uploaded = await Promise.all(
        blocks.map(async b => {
          if (b.type === 'image' && b.file) {
            const form = new FormData();
            form.append('file', b.file);
            const { data } = await api.post(`${API_PREFIX}/uploads/image`, form, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            return { ...b, src: data.url, file: undefined };
          }
          return b;
        })
      );

      // 서버 payload
      const blocksPayload = uploaded.map(b => {
         if (b.type === 'video') {
           return {
             _id: b.id,
             type: 'video',
             youtubeId: b.youtubeId,
             ratio: b.ratio || { w: 16, h: 9 },
             autoplay: ['true', '1', 'on', true, 1].includes(b.autoplay),
             loop: ['true', '1', 'on', true, 1].includes(b.loop)
           };
         }
        if (b.type === 'text') {
          return { _id: b.id, type: 'text', text: b.text, style: b.style || {} };
        }
        return {
          _id: b.id,
          type: 'image',
          src: b.src,
          regions: (b.regions || []).map(r => ({
            _id: r.id,
            xRatio: r.xRatio,
            yRatio: r.yRatio,
            wRatio: r.wRatio,
            hRatio: r.hRatio,
            href: r.href,
            coupon: r.coupon,
          })),
        };
      });

      const imageOnly = blocksPayload.filter(b => b.type === 'image');

      // 안전하게 classification 구성: layoutType이 특정 값일 때만 해당 필드 포함
      const classification = { registerMode };
      if (registerMode === 'category') {
        if (layoutType === 'single') {
          classification.root = singleRoot;
          classification.sub = singleSub;
        } else if (layoutType === 'tabs') {
          classification.tabs = tabs;
          classification.activeColor = activeColor;
        }
      } else if (registerMode === 'direct') {
        if (layoutType === 'single') {
          classification.directProducts = directProducts;
        } else if (layoutType === 'tabs') {
          classification.tabDirectProducts = tabDirectProducts;
          classification.tabs = tabs;
          classification.activeColor = activeColor;
        }
      }
      // if registerMode === 'none', classification remains { registerMode: 'none' }

      const payload = {
        title,
        content: {
          images: imageOnly.map(i => i.src),
          blocks: blocksPayload,
          gridSize,
          layoutType,
          classification: { registerMode },
        },
        images: imageOnly.map(i => ({ _id: i._id, src: i.src, regions: i.regions })), // 하위호환
        gridSize,
        layoutType,
        classification, // safe classification composed above
      };

      const res = await api.post(`${API_PREFIX}/eventTemple`, payload);
      const eventId = res.data?._id;
      if (eventId) {
        msgApi.success('이벤트 생성 완료');
        navigate(`/event/detail/${eventId}`);
      } else {
        msgApi.error('이벤트 ID를 찾을 수 없습니다.');
      }
    } catch (e) {
      console.error(e);
      /** ✅ “게시판 생성 갯수 제한” 고정 문구 제거 → 서버 메시지 그대로 출력 */
      const serverMsg =
        e?.response?.data?.message || e?.response?.data?.error || e?.message || '이벤트 생성 중 오류가 발생했습니다.';
      msgApi.error(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // 상품 그리드 헬퍼
  function renderGrid(cols) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols},1fr)`,
          gap: 10,
          maxWidth: 800,
          margin: '24px auto',
        }}
      >
        {Array.from({ length: cols * cols }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 120,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
            }}
          >
            <BlockOutlined style={{ fontSize: 30 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {msgCtx}
      <Card
        title="이벤트 만들기 & 영역 매핑"
        className="event-create-card"
        style={{ width: '100%', margin: '0 auto', padding: isMobile ? 8 : 24 }}
      >
        <Steps current={current} size={isMobile ? 'small' : 'default'} direction={isMobile ? 'vertical' : 'horizontal'} style={{ marginBottom: 24 }}>
          <Step title="제목 입력" />
          <Step title="이미지 업로드" />
          <Step title="상품등록 방식 설정" />
          <Step title="확인 & 등록" />
        </Steps>

        {/* Step 1 */}
        {current === 0 && (
          <Input ref={titleRef} placeholder="이벤트 제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} />
        )}

        {/* Step 2 */}
        {current === 1 && (
          <>
            <Upload.Dragger {...uploadProps} className="dragger" style={{ padding: isMobile ? 12 : 24, width: '100%' }}>
              <p><InboxOutlined style={{ fontSize: 24 }} /></p>
              <p>이미지를 드래그 또는 클릭하여 업로드</p>
            </Upload.Dragger>

            {/* 컨트롤 */}
            <Space style={{ margin: '12px 0' }} wrap>
              <Button
                icon={<LinkOutlined />}
                type={addingMode && addType === 'link' ? 'primary' : 'default'}
                onClick={() => {
                  const hasImage = blocks.some(b => b.type === 'image');
                  if (!hasImage) { msgApi.info('이미지 추가 후 이용 가능'); return; }
                  if (showAllPreview) { msgApi.info('추가하실 썸네일은 선택해주세요'); return; }
                  if (!selectedBlock) { msgApi.info('추가하실 썸네일은 선택해주세요'); return; }
                  if (selectedBlock.type !== 'image') { msgApi.info('이미지에서만 영역 매핑이 가능합니다.'); return; }
                  setAddType('link'); setAddingMode(true);
                }}
              >
                URL 추가
              </Button>
              <Button
                icon={<TagOutlined />}
                type={addingMode && addType === 'coupon' ? 'primary' : 'default'}
                onClick={() => {
                  const hasImage = blocks.some(b => b.type === 'image');
                  if (!hasImage) { msgApi.info('이미지 추가 후 이용 가능'); return; }
                  if (showAllPreview) { msgApi.info('추가하실 썸네일은 선택해주세요'); return; }
                  if (!selectedBlock) { msgApi.info('추가하실 썸네일은 선택해주세요'); return; }
                  if (selectedBlock.type !== 'image') { msgApi.info('이미지에서만 영역 매핑이 가능합니다.'); return; }
                  setAddType('coupon'); setAddingMode(true);
                }}
              >
                쿠폰 추가
              </Button>
              <Button
                icon={<YoutubeOutlined />}
                onClick={() => { setVideoModalVisible(true); setShowAllPreview(false); }}
              >
                YouTube 추가
              </Button>
              <Button
                icon={<FontSizeOutlined />}
                onClick={openCreateText}
              >
                텍스트 추가
              </Button>

              {/* 전체 보기 토글 */}
              <Button
                style={{
                  marginLeft: 8,
                  background: showAllPreview ? '#fe6326' : undefined,
                  color: showAllPreview ? '#fff' : undefined,
                  borderColor: showAllPreview ? '#fe6326' : undefined,
                }}
                onClick={() => {
                  const hasImage = blocks.some(b => b.type === 'image');
                  if (!hasImage) { msgApi.info('이미지 추가 후 이용 가능'); return; }
                  setShowAllPreview(prev => !prev);
                }}
              >
                전체보기
              </Button>
            </Space>

            {/* 썸네일 */}
            {blocks.length > 0 && (
              <DragDropContext
                onDragStart={() => { draggingRef.current = true; }}
                onDragEnd={onDragEnd}
              >
                <Droppable droppableId="thumbs" direction="horizontal">
                  {(prov) => (
                    <div ref={prov.innerRef} {...prov.droppableProps} className="thumb-list">
                      {blocks.map((b, idx) => (
                        <Draggable key={b.id} draggableId={b.id} index={idx}>
                          {(p, snapshot) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              className={`thumb-item ${b.id === selectedId ? 'active' : ''}`}
                              onPointerUp={() => {
                                if (draggingRef.current) return;
                                if (showAllPreview) setShowAllPreview(false);
                                setSelectedId(b.id);
                              }}
                              style={getItemStyle(snapshot.isDragging, p.draggableProps.style)}
                            >
                              {b.type === 'video' ? (
                                <img src={`https://img.youtube.com/vi/${b.youtubeId}/hqdefault.jpg`} alt="" />
                              ) : b.type === 'text' ? (
                                <div
                                  title="텍스트 블록"
                                  style={{
                                    width:'100%', height:'100%',
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                    background:'#f5f5f5', color:'#888', fontSize:24, fontWeight:700,
                                    borderRadius:4,
                                  }}
                                >
                                  Tt
                                </div>
                              ) : (
                                <img src={b.src} alt="" />
                              )}

                              <DeleteOutlined
                                className="thumb-delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBlocks(prev => prev.filter(x => x.id !== b.id));
                                  if (selectedId === b.id) setSelectedId(null);
                                }}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            {/* 프리뷰 */}
            <div style={{ width: '100%', marginTop: 16, textAlign: 'center' }}>
              {showAllPreview ? (
                // 전체 보기
                <div style={{ display: 'grid', gap:0, maxWidth: 800, margin: '0 auto' }}>
                  {blocks.map(b =>
                    b.type === 'video' ? (
                      <div key={b.id} style={{ width: '100%' }}>
                        <YouTubeAuto
                          videoId={b.youtubeId}
                          autoplay={!!b.autoplay}
                          loop={!!b.loop}
                          aspectW={b.ratio?.w || 16}
                          aspectH={b.ratio?.h || 9}
                        />
                      </div>
                    ) : b.type === 'text' ? (
                      <div key={b.id} style={{ textAlign: b.style?.align || 'center', marginTop: b.style?.mt ?? 16, marginBottom: b.style?.mb ?? 16 }}>
                        <div
                          style={{ fontSize: b.style?.fontSize || 18, fontWeight: b.style?.fontWeight || 'normal', color: b.style?.color || '#333' }}
                          dangerouslySetInnerHTML={{ __html: escapeHtml(b.text).replace(/\n/g, '<br/>') }}
                        />
                      </div>
                    ) : (
                      <img key={b.id} src={b.src} alt="" style={{ width: '100%', maxWidth: 800, margin: '0 auto' }} />
                    )
                  )}
                </div>
              ) : (
                // 상세 편집
                <>
                  {selectedBlock?.type === 'image' && (
                    <div
                      ref={imgRef}
                      onMouseDown={addingMode ? onMouseDown : undefined}
                      onMouseMove={addingMode ? onMouseMove : undefined}
                      onMouseUp={addingMode ? onMouseUp : undefined}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        maxWidth: 800,
                        width: '100%',
                        cursor: addingMode ? 'crosshair' : 'default',
                      }}
                    >
                      <img src={selectedBlock.src} alt="" style={{ width: '100%', userSelect: 'none' }} draggable={false} />
                      {dragStartPos && dragCurrent && (
                        <div
                          style={{
                            position: 'absolute',
                            left: Math.min(dragStartPos.x, dragCurrent.x),
                            top: Math.min(dragStartPos.y, dragCurrent.y),
                            width: Math.abs(dragCurrent.x - dragStartPos.x),
                            height: Math.abs(dragCurrent.y - dragStartPos.y),
                            border: '1px dashed #999',
                            background: 'rgba(200,200,200,0.2)',
                          }}
                        />
                      )}
                      {(selectedBlock.regions || []).map(r => {
                        const base = {
                          position: 'absolute',
                          left: `${(r.xRatio * 100).toFixed(2)}%`,
                          top: `${(r.yRatio * 100).toFixed(2)}%`,
                          width: `${(r.wRatio * 100).toFixed(2)}%`,
                          height: `${(r.hRatio * 100).toFixed(2)}%`,
                          cursor: 'pointer',
                        };
                        const style = r.coupon
                          ? { ...base, border: '2px dashed #ff6347', background: 'rgba(255,99,71,0.2)' }
                          : { ...base, border: '2px dashed #1890ff', background: 'rgba(24,144,255,0.2)' };
                        return r.coupon ? (
                          <button key={r.id} style={style} onClick={e => { e.stopPropagation(); openEditRegion(r); }} />
                        ) : (
                          <a
                            key={r.id}
                            style={style}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); openEditRegion(r);} }
                          />
                        );
                      })}
                    </div>
                  )}

                  {selectedBlock?.type === 'video' && (
                    <div style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}>
                      <YouTubeAuto
                        videoId={selectedBlock.youtubeId}
                        autoplay={!!selectedBlock.autoplay}
                        loop={!!selectedBlock.loop}
                        aspectW={selectedBlock.ratio?.w || 16}
                        aspectH={selectedBlock.ratio?.h || 9}
                      />

                      {/* ✅ autoplay / loop 체크박스 (즉시 반영) */}
                      <div style={{ marginTop: 8 }}>
                        <Checkbox
                          checked={!!selectedBlock.autoplay}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBlocks(prev =>
                              prev.map(b => b.id === selectedBlock.id ? { ...b, autoplay: checked, loop: checked ? true : b.loop } : b)
                            );
                          }}
                          style={{ marginRight: 12 }}
                        >
                          자동 재생 (자동재생 시 반복이 자동 적용됩니다)
                        </Checkbox>

                        {/* loop 체크박이는 자동 설정으로 제거됨 */}
                      </div>

                      {addingMode && (
                        <Alert type="info" message="영상에는 매핑을 적용할 수 없습니다." showIcon style={{ marginTop: 8 }} />
                      )}
                    </div>
                  )}

                  {selectedBlock?.type === 'text' && (
                    <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
                      <div
                        style={{
                          border: '1px dashed #ccc',
                          padding: 16,
                          background: '#fafafa',
                          marginTop: selectedBlock.style?.mt ?? 16,
                          marginBottom: selectedBlock.style?.mb ?? 16,
                          textAlign: selectedBlock.style?.align || 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: selectedBlock.style?.fontSize || 18,
                            fontWeight: selectedBlock.style?.fontWeight || 'normal',
                            color: selectedBlock.style?.color || '#333',
                          }}
                          dangerouslySetInnerHTML={{ __html: escapeHtml(selectedBlock.text).replace(/\n/g, '<br/>') }}
                        />
                      </div>
                      <Button onClick={() => openEditText(selectedBlock)}>텍스트 편집</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Step 3 */}
        {current === 2 && (
          <div style={{ maxWidth: 400 }}>
            <h4>상품 등록 방식</h4>
            <Segmented
              options={[
                { label: '카테고리 상품 등록', value: 'category' },
                { label: '직접 상품 등록', value: 'direct' },
                { label: '노출안함', value: 'none' },
              ]}
              value={registerMode}
              onChange={handleRegisterModeChange}
              block
              style={{ marginBottom: 24 }}
            />

            {/* 카테고리 */}
            {registerMode === 'category' && (
              <>
                <h4>그리드 사이즈</h4>
                <Space>
                  {[2, 3, 4].map(n => (
                    <Button key={n} type={gridSize === n ? 'primary' : 'default'} onClick={() => setGridSize(n)}>
                      {n}×{n}
                    </Button>
                  ))}
                </Space>

                <h4 style={{ margin: '16px 0' }}>노출 방식</h4>
                <Segmented
                  options={[
                    { label: '단품상품', value: 'single' },
                    { label: '탭상품', value: 'tabs' },
                  ]}
                  value={layoutType}
                  onChange={val => {
                    setLayoutType(val);
                    setSingleRoot(null);
                    setSingleSub(null);
                    setTabs([{ title: '', root: null, sub: null }, { title: '', root: null, sub: null }]);
                    setActiveColor('#fe6326');
                  }}
                  block
                />

                {layoutType === 'single' && (
                  <Space style={{ marginTop: 24 }}>
                    <Select placeholder="대분류" style={{ width: 180 }} value={singleRoot} onChange={setSingleRoot}>
                      {roots.map(r => (
                        <Select.Option key={r.category_no} value={String(r.category_no)}>
                          {r.category_name}
                        </Select.Option>
                      ))}
                    </Select>
                    <Select placeholder="소분류" style={{ width: 180 }} value={singleSub} onChange={setSingleSub}>
                      {subs.map(s => (
                        <Select.Option key={s.category_no} value={String(s.category_no)}>
                          {s.category_name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Space>
                )}

                {layoutType === 'tabs' && (
                  <>
                    {tabs.map((t, i) => (
                      <Space key={i} size="middle" style={{ marginTop: 16, alignItems: 'center' }}>
                        <Input
                          placeholder={`탭 ${i + 1} 제목`}
                          style={{ width: 120 }}
                          value={t.title}
                          onChange={e => updateTab(i, 'title', e.target.value)}
                        />
                        <Select placeholder="대분류" style={{ width: 140 }} value={t.root} onChange={v => updateTab(i, 'root', v)}>
                          {roots.map(r => (
                            <Select.Option key={r.category_no} value={String(r.category_no)}>
                              {r.category_name}
                            </Select.Option>
                          ))}
                        </Select>
                        <Select placeholder="소분류" style={{ width: 140 }} value={t.sub} onChange={v => updateTab(i, 'sub', v)}>
                          {allCats
                            .filter(c => c.category_depth === 2 && String(c.parent_category_no) === t.root)
                            .map(s => (
                              <Select.Option key={s.category_no} value={String(s.category_no)}>
                                {s.category_name}
                              </Select.Option>
                            ))}
                        </Select>

                        {/* 삭제 버튼: 탭이 3개 이상일 때만 보여주어 최소 2개 유지 */}
                        {tabs.length >= 3 && (
                          <DeleteOutlined
                            onClick={() => {
                              // 확인 없이 바로 삭제 (원하면 confirm 추가 가능)
                              removeTab(i);
                            }}
                            style={{ cursor: 'pointer', color: '#ff4d4f' }}
                          />
                        )}
                      </Space>
                    ))}
                    <Button type="dashed" block style={{ marginTop: 16 }} onClick={addTab} disabled={tabs.length >= 4}>
                      + 탭 추가
                    </Button>
                    <Space style={{ marginTop: 12, alignItems: 'center' }}>
                      <span>활성 탭 색:</span>
                      <Input
                        type="color"
                        value={activeColor}
                        onChange={e => setActiveColor(e.target.value)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none' }}
                      />
                    </Space>
                  </>
                )}
              </>
            )}

            {/* 직접 등록 */}
            {registerMode === 'direct' && (
              <>
                <h4>그리드 사이즈</h4>
                <Space>
                  {[2, 3, 4].map(n => (
                    <Button key={n} type={gridSize === n ? 'primary' : 'default'} onClick={() => setGridSize(n)}>
                      {n}×{n}
                    </Button>
                  ))}
                </Space>

                <h4 style={{ margin: '16px 0' }}>노출 방식</h4>
                <Segmented
                  options={[
                    { label: '단품상품', value: 'single' },
                    { label: '탭상품', value: 'tabs' },
                  ]}
                  value={layoutType}
                  onChange={val => {
                    setLayoutType(val);
                    setTabs([{ title: '', root: null, sub: null }, { title: '', root: null, sub: null }]);
                  }}
                  block
                />

                {layoutType === 'single' && (
                  <Button
                    type={directProducts.length > 0 ? 'primary' : 'dashed'}
                    onClick={() => openMorePrd('direct')}
                    style={{ marginTop: 16 }}
                  >
                    {directProducts.length ? `상품 ${directProducts.length}개 등록됨` : '상품 직접 등록'}
                  </Button>
                )}

                {layoutType === 'tabs' && (
                  <>
                    {tabs.map((t, i) => (
                      <Space key={i} size="middle" style={{ marginTop: 16, alignItems: 'center' }}>
                        <Input
                          placeholder={`탭 ${i + 1} 제목`}
                          style={{ width: 120 }}
                          value={t.title}
                          onChange={e => updateTab(i, 'title', e.target.value)}
                        />
                        <Button
                          type={(tabDirectProducts[i] || []).length > 0 ? 'primary' : 'default'}
                          onClick={() => openMorePrd('tab', i)}
                        >
                          {(tabDirectProducts[i] || []).length
                            ? `상품 ${(tabDirectProducts[i] || []).length}개 등록됨`
                            : '상품 직접 등록'}
                        </Button>

                        {/* 삭제 버튼: 탭이 3개 이상일 때만 보이도록 (최소 2개 유지) */}
                        {tabs.length >= 3 && (
                          <DeleteOutlined
                            onClick={() => removeTab(i)}
                            style={{ cursor: 'pointer', color: '#ff4d4f' }}
                          />
                        )}
                      </Space>
                    ))}
                    <Button type="dashed" block style={{ marginTop: 16 }} onClick={addTab} disabled={tabs.length >= 4}>
                      + 탭 추가
                    </Button>
                    <Space style={{ marginTop: 12, alignItems: 'center' }}>
                      <span>활성 탭 색:</span>
                      <Input
                        type="color"
                        value={activeColor}
                        onChange={e => setActiveColor(e.target.value)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none' }}
                      />
                    </Space>
                  </>
                )}
              </>
            )}

            {registerMode === 'none' && (
              <div style={{ textAlign: 'left', color: '#fe6326', padding: 5 }}>상품을 노출하지 않습니다.</div>
            )}
          </div>
        )}

        {/* Step 4 */}
        {current === 3 && (
          <div style={{ marginTop: 24 }}>
            <h4>미리보기</h4>
            <div style={{ display: 'grid', gap: 0, maxWidth: 800, margin: '0 auto' }}>
              {blocks.map(b =>
                b.type === 'video' ? (
                  <div key={b.id} style={{ width: '100%' }}>
                    <YouTubeAuto
                      videoId={b.youtubeId}
                      autoplay={!!b.autoplay}
                      loop={!!b.loop}
                      aspectW={b.ratio?.w || 16}
                      aspectH={b.ratio?.h || 9}
                    />
                  </div>
                ) : b.type === 'text' ? (
                  <div key={b.id} style={{ textAlign: b.style?.align || 'center', marginTop: b.style?.mt ?? 16, marginBottom: b.style?.mb ?? 16 }}>
                    <div
                      style={{ fontSize: b.style?.fontSize || 18, fontWeight: b.style?.fontWeight || 'normal', color: b.style?.color || '#333' }}
                      dangerouslySetInnerHTML={{ __html: escapeHtml(b.text).replace(/\n/g, '<br/>') }}
                    />
                  </div>
                ) : (
                  <img key={b.id} src={b.src} alt="미리보기" style={{ width: '100%' }} />
                )
              )}
            </div>

            {/* Only render product grid/tabs if registerMode is not 'none' */}
            {registerMode !== 'none' && layoutType === 'single' && <div style={{ marginTop: 24 }}>{renderGrid(gridSize)}</div>}
            {registerMode !== 'none' && layoutType === 'tabs' && (
              <div style={{ margin: '24px auto', maxWidth: 800 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {tabs.map((t, i) => (
                    <Button key={i} style={{ flex: 1, background: i === 0 ? activeColor : undefined, color: i === 0 ? '#fff' : undefined }}>
                      {t.title || `탭${i + 1}`}
                    </Button>
                  ))}
                </div>
                {renderGrid(gridSize)}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Button type="primary" size="large" onClick={handleSubmit} block={isMobile} loading={submitting} disabled={submitting}>
                이벤트 등록
              </Button>
            </div>
          </div>
        )}

        {/* Prev/Next */}
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ marginTop: 24, width: '100%', justifyContent: 'space-between' }}>
          {current > 0 && <Button onClick={prev} block={isMobile}>이전</Button>}
          {current < 3 && <Button type="primary" onClick={next} block={isMobile}>다음</Button>}
        </Space>
      </Card>

      {/* 매핑 추가 모달 */}
      <Modal
        open={mapModalVisible}
        title={addType === 'link' ? 'URL 영역 설정' : '쿠폰 영역 설정'}
        onCancel={() => {
          setMapModalVisible(false);
          setPendingRegion(null);
          setAddingMode(false);
          setAddType(null);
          mapForm.resetFields();
        }}
        onOk={saveRegion}
        okText="적용"
        width={isMobile ? '90%' : 600}
      >
        <Form form={mapForm} layout="vertical">
          {addType === 'link' ? (
            <Form.Item name="href" label="URL" rules={[{ required: true, message: 'URL을 입력해주세요.' }]}>
              <Input placeholder="https://example.com" />
            </Form.Item>
          ) : (
            <Form.Item name="coupon" label="쿠폰 선택 혹은 번호 입력" rules={[{ required: true, message: '쿠폰을 하나 이상 선택/입력하세요.' }]}>
              <Select mode="tags" options={couponOptions} tokenSeparators={[',']} tagRender={tagRender} placeholder="쿠폰 선택 또는 번호 입력" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 매핑 편집 모달 */}
      <Modal
        open={editModalVisible}
        title="영역 편집"
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRegion(null);
        }}
        footer={[
          <Button key="del" danger onClick={deleteRegion}>삭제</Button>,
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>취소</Button>,
          <Button key="ok" type="primary" onClick={applyEditRegion}>적용</Button>,
        ]}
        width={isMobile ? '90%' : 600}
      >
        <Form form={editForm} layout="vertical">
          {editingRegion?.coupon ? (
            <Form.Item name="coupon" label="쿠폰 선택 혹은 번호 입력" rules={[{ required: true, message: '쿠폰을 하나 이상 선택/입력하세요.' }]}>
              <Select mode="tags" options={couponOptions} tokenSeparators={[',']} tagRender={tagRender} />
            </Form.Item>
          ) : (
            <Form.Item name="href" label="URL" rules={[{ required: true, message: 'URL을 입력하세요.' }]}>
              <Input placeholder="https://example.com" />
            </Form.Item>
          )}
        </Form>
      </Modal>
      {/* YouTube 모달 */}
      <Modal
        open={videoModalVisible}
        title="YouTube 영상 추가"
        onCancel={() => {
          setVideoModalVisible(false);
          videoForm.resetFields();
        }}
        onOk={() => {
          const { urlOrId, aspectW = 16, aspectH = 9, autoplay = false } = videoForm.getFieldsValue();
          const vid = getYouTubeId(urlOrId);
          if (!vid) return msgApi.error('유효한 YouTube 링크/ID가 아닙니다.');
          const id = Date.now().toString() + Math.random();
          setBlocks(prev => [
            ...prev,
            {
              id,
              type: 'video',
              youtubeId: vid,
              ratio: { w: Number(aspectW) || 16, h: Number(aspectH) || 9 },
              autoplay: !!autoplay,              // ✅ 저장!
              loop: !!autoplay,                  // autoplay일 때 loop 강제
            }
          ]);
          setSelectedId(id);
          setShowAllPreview(false);
          setVideoModalVisible(false);
          videoForm.resetFields();
        }}
        width={isMobile ? '90%' : 520}
      >
        <Form form={videoForm} layout="vertical" initialValues={{ aspectW: 16, aspectH: 9, autoplay: false }}>
          <Form.Item name="urlOrId" label="YouTube 링크 또는 영상 ID" rules={[{ required: true, message: 'YouTube 링크/ID를 입력하세요.' }]}>
            <Input placeholder="예: https://youtu.be/XXXXXXXXXXX 또는 영상 ID" />
          </Form.Item>
          <Space>
            <Form.Item name="aspectW" label="비율 W" style={{ marginBottom: 0 }}>
              <Input type="number" min={1} step={1} style={{ width: 100 }} />
            </Form.Item>
            <div style={{ alignSelf: 'end', padding: '0 6px 8px' }}>/</div>
            <Form.Item name="aspectH" label="비율 H" style={{ marginBottom: 0 }}>
              <Input type="number" min={1} step={1} style={{ width: 100 }} />
            </Form.Item>
          </Space>
          <Form.Item name="autoplay" valuePropName="checked" style={{ marginTop: 8 }}>
            <Checkbox>자동재생 (자동재생 여부 체크)</Checkbox>
          </Form.Item>
          {/* loop 체크박이는 UI에서 제거 — autoplay일 때 loop 자동 적용 */}
        </Form>
      </Modal>
      {/* 텍스트 모달 */}
      <Modal
        open={textModalVisible}
        title={selectedBlock?.type === 'text' ? '텍스트 편집' : '텍스트 추가'}
        onCancel={() => setTextModalVisible(false)}
        onOk={submitText}
        okText="적용"
        width={isMobile ? '90%' : 520}
      >
        <Form
          form={textForm}
          layout="vertical"
          initialValues={{ text: '', align: 'center', fontSize: 18, fontWeight: 'normal', color: '#333333', mt: 16, mb: 16 }}
        >
          <Form.Item name="text" label="문구" rules={[{ required: true, message: '문구를 입력해주세요.' }]}>
            <Input.TextArea rows={4} placeholder="문구를 입력하세요. 엔터는 줄바꿈(<br/>)으로 표시됩니다." />
          </Form.Item>
          <Space wrap>
            <Form.Item name="align" label="정렬" style={{ marginBottom: 0 }}>
              <Select style={{ width: 110 }}>
                <Select.Option value="left">왼쪽</Select.Option>
                <Select.Option value="center">가운데</Select.Option>
                <Select.Option value="right">오른쪽</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="fontSize" label="폰트크기" style={{ marginBottom: 0 }}>
              <Input type="number" min={10} max={80} step={1} style={{ width: 110 }} />
            </Form.Item>
            <Form.Item name="fontWeight" label="굵기" style={{ marginBottom: 0 }}>
              <Select style={{ width: 110 }}>
                <Select.Option value="normal">보통</Select.Option>
                <Select.Option value="500">500</Select.Option>
                <Select.Option value="600">600</Select.Option>
                <Select.Option value="bold">bold</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="color" label="색상" style={{ marginBottom: 0 }}>
              <Input type="color" style={{ width: 60, padding: 0, border: 'none', background: 'transparent' }} />
            </Form.Item>
            <Form.Item name="mt" label="위 간격(px)" style={{ marginBottom: 0 }}>
              <Input type="number" min={0} step={1} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="mb" label="아래 간격(px)" style={{ marginBottom: 0 }}>
              <Input type="number" min={0} step={1} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 상품 선택 모달 */}
      {morePrdVisible && (
        <MorePrd
          key={`${morePrdTarget}-${morePrdTabIndex}`}
          visible={morePrdVisible}
          target={morePrdTarget}
          tabIndex={morePrdTabIndex}
          initialSelected={initialSelected}
          onOk={selected => {
            if (morePrdTarget === 'direct') setDirectProducts(selected);
            else setTabDirectProducts(prev => ({ ...prev, [morePrdTabIndex]: selected }));
            setMorePrdVisible(false);
          }}
          onCancel={() => setMorePrdVisible(false)}
        />
      )}
    </>
  );
}

// -------------------
// HELPER: escapeHtml (안전한 텍스트 출력)
// -------------------
const escapeHtml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
