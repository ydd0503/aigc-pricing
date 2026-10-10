# 补充数据与推荐接口

欢迎通过 [补充数据 Issue](https://github.com/ydd0503/aigc-pricing/issues/new?template=contribute-data.md) 推荐可核验的数据源。优先提供官方模型目录、生成价格预估、会员套餐、积分充值和优惠规则接口；官方文档链接也很有帮助。

不要求你写采集程序。能提供什么就填写什么，未知项写 `null` 或“未知”。我们会独立核验后再纳入比较。

## 建议提供的信息

| 内容 | 建议字段 |
|---|---|
| 来源 | 平台、官方网页或文档链接、采集时间及时区 |
| 模型 | 官方可见名称、接口模型 ID、版本及 Fast/Pro 等后缀 |
| 接口 | URL、GET/POST、用途、是否需要登录或会员、已知调用频率限制 |
| 生成条件 | 模式、分辨率、画幅、生成秒数、音频开关、参考图数量、参考视频秒数 |
| 报价 | 消耗数值和单位、原价、活动价、是否只是预估；计费积分与充值币请分开 |
| 套餐或优惠 | 实付人民币、周期月数、发放积分及有效期、适用模型、优惠起止时间与资格 |

## 报价样例

这是推荐的整理格式，不是要求平台接口使用同样的字段。优先同时附上接口原始字段的脱敏样例；不要把预估值标成实际扣费。

```json
{
  "platform": "示例平台",
  "source_url": "https://official.example/pricing",
  "captured_at": "2026-10-10T20:00:00+08:00",
  "api": {
    "method": "GET",
    "url": "https://api.example/price-preview",
    "purpose": "报价预估",
    "requires_login": true,
    "membership_required": null,
    "rate_limit": null
  },
  "model": { "id": "官方模型ID", "name": "官方模型名称" },
  "conditions": {
    "mode": "image_to_video",
    "resolution": "720P",
    "aspect_ratio": "adaptive",
    "output_seconds": 10,
    "audio": true,
    "reference_image_count": 1,
    "reference_video_seconds": 0
  },
  "quote": {
    "unit": "平台计费积分",
    "original_total": 200,
    "current_total": 100,
    "is_price_preview": true,
    "promotion": {
      "trigger": "未知",
      "starts_at": null,
      "expires_at": null,
      "eligibility": null
    }
  }
}
```

如果积分总价取决于参考视频时长，请附上该时长；如果报价会随会员档位或新客资格变化，请注明查询时的条件。找不到原价时保留 `null`，不要按折扣比例倒推。

## 公开提交范围

只分享你有权公开的链接、接口说明和脱敏样例。不要提交 Cookie、Token、API Key、账号信息或私人素材；认证字段可说明“需要登录”，无需提供凭据。接口以目录、规则和价格预估查询为主，不需要生成任务、购买或支付接口。

仓库原创内容采用 [MIT 许可](LICENSE)，第三方数据和素材仍遵循其来源条款。补充来源说明不代表第三方内容被重新许可为 MIT。
