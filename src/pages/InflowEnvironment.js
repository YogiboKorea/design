// src/pages/InflowEnvironment.jsx

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Grid,
} from 'antd';
import api from '../axios';                  // ← 우리 axios 인스턴스
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import './NormalSection.css';

dayjs.extend(isSameOrBefore);

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function InflowEnvironment() {
  // ─── 1) mallId 결정 ───────────────────────────────────────────
  const [mallId, setMallId] = useState(null);
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const q       = params.get('mall_id') || params.get('state') || params.get('mallId');
    if (q) {
      localStorage.setItem('mallId', q);
      setMallId(q);
    } else {
      const stored = localStorage.getItem('mallId');
      if (stored) setMallId(stored);
      else message.error('mall_id 파라미터가 없습니다.');
    }
  }, []);

  const screens = useBreakpoint();
  const isMobile = screens.sm === false;

  // ─── 상태 선언 ───────────────────────────────────────────────
  const [events, setEvents]               = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [urls, setUrls]                   = useState([]);
  const [selectedUrl, setSelectedUrl]     = useState(null);
  const [range, setRange]                 = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [minDate, setMinDate]             = useState(null);
  const [pieData, setPieData]             = useState([]);
  const [lineData, setLineData]           = useState({ dates: [], devices: [], series: [] });
  const [loading, setLoading]             = useState(false);

  // ─── helper: 선행 '/', 숫자-segment, skin-mobile, skin-<anything> 반복 제거 후 정규화 ----
  const normalizePath = (urlCandidate) => {
    if (!urlCandidate) return '/';
    // 절대 URL이면 그대로 반환 (http(s) 포함)
    if (/^https?:\/\//i.test(urlCandidate)) return urlCandidate;

    let s = String(urlCandidate).trim();

    // remove leading slashes so patterns match consistently ("/67/test.html" -> "67/test.html")
    s = s.replace(/^\/+/, '');
    if (!s) return '/';

    // patterns to strip repeatedly from the start:
    // - skin-mobile/
    // - skin-<anything>/   (covers skin-skin98 etc)
    // - numeric segment like "67/" or "123/"
    const patterns = [
      /^skin-mobile\/?/i,
      /^skin-[^\/]+\/?/i,
      /^\d+\/?/
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const p of patterns) {
        if (p.test(s)) {
          s = s.replace(p, '');
          changed = true;
        }
      }
    }

    if (!s) return '/';
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  };

  const displayLabel = (u) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return normalizePath(u);
  };

  // ─── 2) 이벤트 목록 로드 ───────────────────────────────────────
  useEffect(() => {
    if (!mallId) return;
    api.get(`/api/${mallId}/events`)
      .then(res => {
        const sorted = (res.data || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setEvents(sorted);
        if (sorted.length) setSelectedEvent(sorted[0]._id);
      })
      .catch(() => {
        message.error('이벤트 목록을 불러오지 못했습니다.');
      });
  }, [mallId]);

  // ─── 3) selectedEvent 변경 시: URL 목록 + 날짜 초기화 ─────────────
  useEffect(() => {
    if (!mallId || !selectedEvent) {
      setUrls([]);
      setSelectedUrl(null);
      setMinDate(null);
      return;
    }

    // URL 목록
    api.get(`/api/${mallId}/analytics/${selectedEvent}/urls`)
      .then(res => {
        const list = res.data || [];
        setUrls(list);
        setSelectedUrl(list[0] || null);
      })
      .catch(() => {
        message.error('URL 목록을 불러오지 못했습니다.');
      });

    // 이벤트 생성일로 최소 날짜 초기화
    const ev = events.find(e => e._id === selectedEvent);
    if (ev?.createdAt) {
      const start = dayjs(ev.createdAt);
      setMinDate(start);
      setRange([start, dayjs()]);
    }
  }, [mallId, selectedEvent, events]);

  // ─── 4) 데이터 조회 함수 ───────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!mallId || !selectedEvent || !selectedUrl) return;
    setLoading(true);

    const [start, end] = range.map(d => d.format('YYYY-MM-DD'));
    const normalizedSelected = normalizePath(selectedUrl);

    const params = {
      start_date: `${start}T00:00:00+09:00`,
      end_date:   `${end}T23:59:59.999+09:00`,
      url:        normalizedSelected,
    };

    try {
      // 디바이스 분포 (pie)
      const devRes = await api.get(
        `/api/${mallId}/analytics/${selectedEvent}/devices`,
        { params }
      );
      const rawPie = Array.isArray(devRes.data) ? devRes.data : [];
      const allDevices = ['PC', 'Android', 'iOS'];
      setPieData(allDevices.map(dev => ({
        name:  dev,
        value: rawPie.find(r => r.device_type === dev)?.count || 0,
      })));

      // 날짜별 디바이스 유입 (line)
      const lineRes = await api.get(
        `/api/${mallId}/analytics/${selectedEvent}/devices-by-date`,
        { params }
      );
      const rawLine = Array.isArray(lineRes.data) ? lineRes.data : [];

      // 날짜 축 생성
      const dates = [];
      let cur  = range[0].startOf('day');
      const last = range[1].startOf('day');
      while (cur.isSameOrBefore(last, 'day')) {
        dates.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }

      // series 구성
      const series = allDevices.map(dev => ({
        name: dev,
        type: 'line',
        data: dates.map(d => {
          const rec = rawLine.find(r => r.date === d && r.device === dev);
          return rec ? rec.count : 0;
        }),
      }));

      setLineData({ dates, devices: allDevices, series });
    } catch (err) {
      console.error('유입환경 데이터 로드 실패', err);
      message.error('유입환경 데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [mallId, selectedEvent, selectedUrl, range]);

  // ─── 5) 자동 조회 트리거 ───────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── ECharts 옵션 ─────────────────────────────────────────────
  const pieOption = {
    title:   { text: '유입 환경 (디바이스)', left: 'center', top: 8, textStyle: { fontSize: isMobile ? 14 : 16 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend:  {
      orient: isMobile ? 'horizontal' : 'vertical',
      bottom: isMobile ? 10 : 'center',
      left:   isMobile ? 'center'   : '75%',
      itemWidth: 12,
      itemHeight:12,
      textStyle:{ fontSize: isMobile ? 12 : 13 }
    },
    series: [ {
      name: '건수', type: 'pie',
      radius:  isMobile ? ['30%','50%'] : ['40%','60%'],
      center:  isMobile ? ['50%','45%'] : ['40%','50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: isMobile ? 12 : 14, fontWeight: 'bold' } },
      data: pieData,
    } ],
  };

  const lineOption = {
    title:   { text: '일자별 디바이스 유입', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend:  {
      data: lineData.devices,
      orient: isMobile ? 'horizontal' : 'vertical',
      bottom: isMobile ? 0 : 'auto',
      left:   isMobile ? 'center' : 'right',
    },
    xAxis:   { type: 'category', data: lineData.dates },
    yAxis:   { type: 'value' },
    series:  lineData.series,
  };

  // ─── 렌더링 ───────────────────────────────────────────────────
  return (
    <Space direction="vertical" style={{ width: '100%' }} className="InflowEnvironment">
      <Card size={isMobile ? 'small' : 'default'}>
        <Space
          wrap
          direction={isMobile ? 'vertical' : 'horizontal'}
          size="middle"
          style={{ width: '100%' }}
        >
          <Select
            placeholder="이벤트 선택"
            options={events.map(e => ({ label: e.title || '(제목없음)', value: e._id }))}
            value={selectedEvent}
            onChange={setSelectedEvent}
            style={{ width: isMobile ? '100%' : 200 }}
            allowClear
          />
          <Select
            placeholder="페이지 선택"
            options={urls.map(u => ({ label: displayLabel(u), value: u }))}
            value={selectedUrl}
            onChange={setSelectedUrl}
            style={{ width: isMobile ? '100%' : 240 }}
            allowClear
          />

          {isMobile ? (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <DatePicker
                value={range[0]}
                onChange={d => d && setRange([d, range[1]])}
                disabledDate={d => minDate && d.isBefore(minDate, 'day')}
                style={{ width: '100%' }}
              />
              <DatePicker
                value={range[1]}
                onChange={d => d && setRange([range[0], d])}
                disabledDate={d => minDate && d.isBefore(minDate, 'day')}
                style={{ width: '100%' }}
              />
            </Space>
          ) : (
            <RangePicker
              value={range}
              onChange={setRange}
              disabledDate={d => minDate && d.isBefore(minDate, 'day')}
              style={{ width: 280 }}
            />
          )}

          <Button type="primary" loading={loading} onClick={fetchData} block={isMobile}>
            검색
          </Button>
        </Space>
      </Card>

      <div style={{
        display:       'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap:           16,
        marginTop:     16,
      }}>
        <Card
          title="디바이스 분포"
          loading={loading}
          style={{ flex: 1 }}
          size={isMobile ? 'small' : 'default'}
        >
          <ReactECharts option={pieOption} style={{ height: isMobile ? 200 : 300 }} />
        </Card>
        <Card
          title="일자별 디바이스 유입"
          loading={loading}
          style={{ flex: 2 }}
          size={isMobile ? 'small' : 'default'}
        >
          <ReactECharts option={lineOption} style={{ height: isMobile ? 200 : 300 }} />
        </Card>
      </div>
    </Space>
  );
}
