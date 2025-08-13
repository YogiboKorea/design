// src/pages/Participation.jsx

import React, { useEffect, useState } from 'react';
import {
  Select,
  Button,
  Table,
  Card,
  Space,
  message,
  Spin,
  Grid,
  DatePicker,
  Typography
} from 'antd';
import dayjs from 'dayjs';
import api from '../axios';

const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function Participation() {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const mallId = localStorage.getItem('mallId');

  const [events, setEvents]               = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [couponNos, setCouponNos]         = useState([]);
  const [range, setRange]                 = useState([ dayjs().subtract(7, 'day'), dayjs() ]);
  const [minDate, setMinDate]             = useState(null);
  const [stats, setStats]                 = useState([]);
  const [loading, setLoading]             = useState(false);

  // 1) Load events & init first event + date
  useEffect(() => {
    if (!mallId) return;
    api.get(`/api/${mallId}/events`)
      .then(({ data }) => {
        const evs = (data||[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        setEvents(evs);
        if (evs.length) {
          const first = evs[0];
          setSelectedEvent(first._id);
          const start = first.createdAt ? dayjs(first.createdAt) : dayjs().subtract(7,'day');
          setMinDate(start);
          setRange([start, dayjs()]);
        }
      })
      .catch(()=>message.error('이벤트 목록 로드 실패'));
  }, [mallId]);

  // 2) On selectedEvent change: fetch coupons & stats in one go
  useEffect(() => {
    // clear UI immediately
    setStats([]);
    setCouponNos([]);
    if (!mallId || !selectedEvent) return;

    (async () => {
      setLoading(true);
      try {
        // 2-1) fetch event detail
        const { data: evDetail } = await api.get(`/api/${mallId}/events/${selectedEvent}`);
        // extract coupons
        const all = [];
        (evDetail.images||[]).forEach(img =>
          (img.regions||[]).forEach(r => {
            if (r.coupon) {
              Array.isArray(r.coupon) ? all.push(...r.coupon) : all.push(r.coupon);
            }
          })
        );
        const newNos = Array.from(new Set(all));
        setCouponNos(newNos);

        // reset date based on event
        const ev = events.find(e=>e._id===selectedEvent);
        const start = ev?.createdAt ? dayjs(ev.createdAt) : dayjs().subtract(7,'day');
        setMinDate(start);
        setRange([start, dayjs()]);

        // 2-2) fetch stats for those coupons
        if (newNos.length > 0) {
          const [s,e] = [start, dayjs()];
          const qs = new URLSearchParams({
            coupon_no:  newNos.join(','),
            start_date: s.format('YYYY-MM-DD'),
            end_date:   e.format('YYYY-MM-DD')
          }).toString();
          const { data: statData } = await api.get(
            `/api/${mallId}/analytics/${selectedEvent}/coupon-stats?${qs}`
          );
          setStats(Array.isArray(statData) ? statData : []);
        }
      } catch (err) {
        message.error('쿠폰 데이터 로드 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [mallId, selectedEvent, events]);

  // 3) Manual fetch (button)
  const onFetch = () => {
    if (!selectedEvent)       return message.warning('게시판을 선택해주세요.');
    if (couponNos.length === 0) return message.warning('등록된 쿠폰이 없습니다.');
    if (range.length !== 2)     return message.warning('기간을 선택해주세요.');

    (async () => {
      setLoading(true);
      setStats([]);
      try {
        const [start, end] = range;
        const qs = new URLSearchParams({
          coupon_no:  couponNos.join(','),
          start_date: start.format('YYYY-MM-DD'),
          end_date:   end.format('YYYY-MM-DD')
        }).toString();
        const { data: statData } = await api.get(
          `/api/${mallId}/analytics/${selectedEvent}/coupon-stats?${qs}`
        );
        setStats(Array.isArray(statData) ? statData : []);
      } catch {
        message.error('쿠폰 통계 조회 실패');
      } finally {
        setLoading(false);
      }
    })();
  };

  // 4) Table setup
  const columns = [
    { title:'쿠폰 번호', dataIndex:'couponNo', key:'couponNo' },
    {
      title:'쿠폰명', dataIndex:'couponName', key:'couponName',
      render:name => name || '기간종료 이벤트'
    },
    {
      title:'다운로드 수', dataIndex:'issuedCount', key:'issuedCount', align:'right',
      render:v=><Text>{v?.toLocaleString()||0}</Text>
    },
    {
      title:'주문 완료 수', dataIndex:'usedCount', key:'usedCount', align:'right',
      render:v=><Text>{v?.toLocaleString()||0}</Text>
    }
  ];

  const totals = stats.reduce((acc, cur) => {
    acc.issued += cur.issuedCount||0;
    acc.used   += cur.usedCount||0;
    acc.unused += cur.unusedCount||0;
    acc.autoDel+= cur.autoDeletedCount||0;
    return acc;
  }, {issued:0, used:0, unused:0, autoDel:0});

  return (
    <Card title="쿠폰 다운로드 / 주문 완료 통계" bodyStyle={{ padding: isMobile?12:24 }} className="participation">
      <Space
        direction={isMobile?'vertical':'horizontal'}
        size="middle" wrap style={{ marginBottom:16 }}
      >
        <Select
          placeholder="게시판 선택"
          options={events.map(e=>({label:e.title||'(제목없음)',value:e._id}))}
          value={selectedEvent}
          onChange={setSelectedEvent}
          style={{ width: isMobile?'100%':240 }}
          allowClear
        />

        {isMobile
          ? (
            <Space direction="vertical" style={{width:'100%'}} size="small">
              <DatePicker
                value={range[0]}
                onChange={d=>d&&setRange([d,range[1]])}
                disabledDate={d=> (minDate&&d.isBefore(minDate,'day'))||d.isAfter(dayjs(),'day')}
                style={{width:'100%'}}
              />
              <DatePicker
                value={range[1]}
                onChange={d=>d&&setRange([range[0],d])}
                disabledDate={d=> (minDate&&d.isBefore(minDate,'day'))||d.isAfter(dayjs(),'day')}
                style={{width:'100%'}}
              />
            </Space>
          )
          : (
            <RangePicker
              value={range}
              onChange={dates=>dates?.length===2&&setRange(dates)}
              disabledDate={d=> (minDate&&d.isBefore(minDate,'day'))||d.isAfter(dayjs(),'day')}
              style={{width:280}}
              format="YYYY-MM-DD"
              separator=" → "
              allowClear={false}
            />
          )
        }

        <Button type="primary" onClick={onFetch} loading={loading} block={isMobile}>
          조회
        </Button>
      </Space>

      {loading ? (
        <Spin tip="로딩 중…" />
      ) : (
        <>
          {stats.length > 0 && (
            <Text strong style={{display:'block',marginBottom:12}}>
              발급 쿠폰수: {totals.issued.toLocaleString()}개&nbsp;
              (사용 쿠폰수: {totals.used.toLocaleString()}개 /
              미사용 쿠폰수: {totals.unused.toLocaleString()}개 /
              자동삭제 수: {totals.autoDel.toLocaleString()}개)
            </Text>
          )}
          <Table
            columns={columns}
            dataSource={stats}
            rowKey="couponNo"
            pagination={false}
            bordered
            scroll={{x:'max-content'}}
          />
        </>
      )}
    </Card>
  );
}
