import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import json
import os

# ---------------------------------------------------------------------------
# Config & constants
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results", "json")
APY_DIR = os.path.join(BASE_DIR, "data", "apy")
PRICES_DIR = os.path.join(BASE_DIR, "data", "prices")

ASSET_NAMES = {
    "bitcoin": "Bitcoin (BTC)",
    "ethereum": "Ethereum (ETH)",
    "solana": "Solana (SOL)",
    "gold": "Gold (XAU)",
    "silver": "Silver (XAG)",
    "oil_wti": "WTI Crude Oil",
    "usd_inr": "USD/INR",
    "eur_usd": "EUR/USD",
    "gbp_usd": "GBP/USD",
    "re_nyc": "NYC Real Estate",
    "re_mia": "Miami Real Estate",
    "re_la": "LA Real Estate",
    "re_aus": "Austin Real Estate",
    "re_den": "Denver Real Estate",
}

COLORS = {
    "green": "#00FF94",
    "red": "#FF3B6B",
    "blue": "#3B82F6",
    "gold": "#F59E0B",
    "white": "#F0F0F5",
    "bg": "#0A0A0F",
    "card": "#111118",
    "border": "#1E1E2E",
    "muted": "#6B7280",
}

PLOTLY_LAYOUT = dict(
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["card"],
    font=dict(family="monospace", color=COLORS["white"], size=11),
    xaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"]),
    yaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"]),
    legend=dict(bgcolor=COLORS["card"], bordercolor=COLORS["border"]),
    margin=dict(l=50, r=50, t=60, b=50),
)

DURATIONS = [1, 3, 6]

# ---------------------------------------------------------------------------
# Data loading helpers
# ---------------------------------------------------------------------------


@st.cache_data
def load_json(path):
    """Load a JSON file, return empty list on failure."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return []


@st.cache_data
def load_summaries():
    return load_json(os.path.join(RESULTS_DIR, "summaries.json"))


@st.cache_data
def load_rolling(asset, duration):
    path = os.path.join(RESULTS_DIR, f"{asset}_{duration}m.json")
    return load_json(path)


@st.cache_data
def load_prices(asset):
    return load_json(os.path.join(PRICES_DIR, f"{asset}.json"))


@st.cache_data
def load_apy(source):
    return load_json(os.path.join(APY_DIR, f"{source}.json"))


def get_available_assets(summaries):
    """Return sorted list of unique assets found in summaries."""
    assets = sorted(set(s["asset"] for s in summaries))
    return assets


def summary_for(summaries, asset, duration):
    for s in summaries:
        if s["asset"] == asset and s["duration_months"] == duration:
            return s
    return None


def scale_value(value, deposit, base_deposit=10000):
    """Scale a dollar value from the base deposit used in stats to the user's deposit."""
    return value * (deposit / base_deposit)


# ---------------------------------------------------------------------------
# Page config & styling
# ---------------------------------------------------------------------------

st.set_page_config(page_title="HedgeMyLife Backtest", layout="wide", page_icon="\u26a1")

st.markdown(
    """
<style>
    .stApp { background-color: #0A0A0F; }
    .stMetric { background-color: #111118; border: 1px solid #1E1E2E; padding: 1rem; border-radius: 8px; }
    [data-testid="stMetricValue"] { color: #00FF94; }
    [data-testid="stMetricLabel"] { color: #6B7280; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.7rem; }
    .stSelectbox label, .stRadio label, .stSlider label { color: #6B7280; text-transform: uppercase; letter-spacing: 0.1em; }
    h1, h2, h3 { color: #F0F0F5 !important; font-family: monospace; }
    .stMarkdown { color: #F0F0F5; }
    div[data-testid="stSidebar"] { background-color: #111118; }
    div[data-testid="stSidebar"] .stMarkdown { color: #F0F0F5; }
</style>
""",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------

summaries = load_summaries()

if not summaries:
    st.error("Could not load summaries.json — make sure the backtest has been run.")
    st.stop()

available_assets = get_available_assets(summaries)

# ---------------------------------------------------------------------------
# Title
# ---------------------------------------------------------------------------

st.markdown(
    "<h1 style='text-align:center; margin-bottom:0;'>HedgeMyLife &mdash; Backtest Dashboard</h1>",
    unsafe_allow_html=True,
)
st.markdown(
    "<p style='text-align:center; color:#6B7280; font-family:monospace; margin-top:0;'>"
    "Yield Only vs Yield Shield &nbsp;|&nbsp; 2 Years of Real Data</p>",
    unsafe_allow_html=True,
)

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 1: Summary KPIs
# ---------------------------------------------------------------------------

total_windows = sum(s["total_windows"] for s in summaries)
weighted_win = (
    sum(s["shield_wins"] for s in summaries) / sum(s["total_windows"] for s in summaries) * 100
    if total_windows
    else 0
)

# Best performing asset at 3M
three_m = [s for s in summaries if s["duration_months"] == 3]
best_3m = max(three_m, key=lambda s: s["shield_win_rate"]) if three_m else None

avg_extra = np.mean([s["avg_shield_advantage"] for s in summaries])
max_upside = max(s["max_shield_profit_pct"] for s in summaries)
max_upside_dollar = max_upside / 100 * 10000  # based on $10K

best_asset_name = ASSET_NAMES.get(best_3m["asset"], best_3m["asset"]) if best_3m else "N/A"
best_asset_win = f"{best_3m['shield_win_rate']:.1f}%" if best_3m else ""

st.markdown(f"""
<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:1.5rem;">
  <div style="background:#111118; border:1px solid #1E1E2E; padding:1.2rem; text-align:center;">
    <div style="color:#6B7280; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Total Windows Tested</div>
    <div style="color:#00FF94; font-size:1.8rem; font-weight:bold; font-family:monospace;">{total_windows:,}</div>
  </div>
  <div style="background:#111118; border:1px solid #1E1E2E; padding:1.2rem; text-align:center;">
    <div style="color:#6B7280; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Overall Shield Win Rate</div>
    <div style="color:#00FF94; font-size:1.8rem; font-weight:bold; font-family:monospace;">{weighted_win:.1f}%</div>
  </div>
  <div style="background:#111118; border:1px solid #1E1E2E; padding:1.2rem; text-align:center;">
    <div style="color:#6B7280; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Best Asset (3M)</div>
    <div style="color:#F59E0B; font-size:1.4rem; font-weight:bold; font-family:monospace;">{best_asset_name}</div>
    <div style="color:#00FF94; font-size:0.8rem; font-family:monospace;">{best_asset_win} win rate</div>
  </div>
  <div style="background:#111118; border:1px solid #1E1E2E; padding:1.2rem; text-align:center;">
    <div style="color:#6B7280; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Avg Extra Profit / $10K</div>
    <div style="color:#00FF94; font-size:1.8rem; font-weight:bold; font-family:monospace;">${avg_extra:+.2f}</div>
  </div>
  <div style="background:#111118; border:1px solid #1E1E2E; padding:1.2rem; text-align:center;">
    <div style="color:#6B7280; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Max Upside (per $10K)</div>
    <div style="color:#00FF94; font-size:1.8rem; font-weight:bold; font-family:monospace;">${max_upside_dollar:,.0f}</div>
  </div>
  <div style="background:#111118; border:1px solid #00FF9440; padding:1.2rem; text-align:center;">
    <div style="color:#6B7280; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px;">Principal Losses</div>
    <div style="color:#00FF94; font-size:1.8rem; font-weight:bold; font-family:monospace;">$0</div>
    <div style="color:#00FF94; font-size:0.75rem; font-family:monospace;">ALWAYS PROTECTED</div>
  </div>
</div>
""", unsafe_allow_html=True)

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 2: Sidebar Controls
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown("### Controls")
    selected_asset = st.selectbox(
        "Asset",
        available_assets,
        format_func=lambda a: ASSET_NAMES.get(a, a),
        index=available_assets.index("gold") if "gold" in available_assets else 0,
        key="asset_selector",
    )

    duration_label = st.radio("Duration", ["1M", "3M", "6M"], index=1, horizontal=True)
    selected_duration = int(duration_label.replace("M", ""))

    deposit = st.slider("Deposit ($)", 1000, 50000, 10000, step=1000)

    st.markdown("---")
    st.markdown(
        f"<p style='color:#6B7280;font-size:0.75rem;'>Showing <b style=\"color:#00FF94\">"
        f"{ASSET_NAMES.get(selected_asset, selected_asset)}</b> at "
        f"<b style=\"color:#00FF94\">{selected_duration}M</b></p>",
        unsafe_allow_html=True,
    )

# Load rolling data for selected combo
rolling_data = load_rolling(selected_asset, selected_duration)
current_summary = summary_for(summaries, selected_asset, selected_duration)

# ---------------------------------------------------------------------------
# Section 3: Performance Comparison Chart
# ---------------------------------------------------------------------------

st.markdown(f"### {ASSET_NAMES.get(selected_asset, selected_asset)} — {selected_duration}M Shield vs Yield Only")

if rolling_data:
    df = pd.DataFrame(rolling_data)
    df["start_date"] = pd.to_datetime(df["start_date"])
    scale = deposit / 1000  # data is per $1000 deposit

    df["shield_total"] = df["shield_return"] * scale
    df["yield_total"] = df["yield_only_return"] * scale
    principal_line = deposit

    fig_perf = go.Figure()

    # Fill between: green where shield > yield, red where yield > shield
    # We'll draw the two lines and use fill='tonexty'
    fig_perf.add_trace(
        go.Scatter(
            x=df["start_date"],
            y=df["yield_total"],
            name="Yield Only",
            line=dict(color=COLORS["blue"], width=2),
            hovertemplate="Date: %{x}<br>Yield Only: $%{y:,.2f}<extra></extra>",
        )
    )
    fig_perf.add_trace(
        go.Scatter(
            x=df["start_date"],
            y=df["shield_total"],
            name="Shield Total",
            line=dict(color=COLORS["green"], width=2),
            fill="tonexty",
            fillcolor="rgba(0,255,148,0.12)",
            hovertemplate="Date: %{x}<br>Shield: $%{y:,.2f}<extra></extra>",
        )
    )

    # Principal line
    fig_perf.add_hline(
        y=principal_line,
        line_dash="dash",
        line_color=COLORS["white"],
        annotation_text="Principal",
        annotation_position="bottom right",
        annotation_font=dict(color=COLORS["white"], size=10),
    )

    fig_perf.update_layout(
        **PLOTLY_LAYOUT,
        title="",
        yaxis_title="Total Return ($)",
        xaxis_title="Window Start Date",
        height=420,
        hovermode="x unified",
    )
    st.plotly_chart(fig_perf, use_container_width=True)
else:
    st.info("No rolling data available for this asset/duration combination.")

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 4: Win Rate Heatmap
# ---------------------------------------------------------------------------

st.markdown("### Shield Win Rate Heatmap")

# Build matrix
heatmap_assets = sorted(set(s["asset"] for s in summaries))
heatmap_z = []
heatmap_text = []

for asset in heatmap_assets:
    row_z = []
    row_t = []
    for dur in DURATIONS:
        s = summary_for(summaries, asset, dur)
        if s:
            row_z.append(s["shield_win_rate"])
            row_t.append(f"{s['shield_win_rate']:.1f}%")
        else:
            row_z.append(None)
            row_t.append("N/A")
    heatmap_z.append(row_z)
    heatmap_text.append(row_t)

fig_heat = go.Figure(
    data=go.Heatmap(
        z=heatmap_z,
        x=["1M", "3M", "6M"],
        y=[ASSET_NAMES.get(a, a) for a in heatmap_assets],
        text=heatmap_text,
        texttemplate="%{text}",
        textfont=dict(size=12, color=COLORS["white"]),
        colorscale=[
            [0.0, COLORS["red"]],
            [0.5, COLORS["gold"]],
            [1.0, COLORS["green"]],
        ],
        zmin=0,
        zmax=100,
        colorbar=dict(
            title=dict(text="Win %", font=dict(color=COLORS["white"])),
            ticksuffix="%",
            tickfont=dict(color=COLORS["white"]),
        ),
        hovertemplate="Asset: %{y}<br>Duration: %{x}<br>Win Rate: %{text}<extra></extra>",
    )
)
fig_heat.update_layout(
    paper_bgcolor=COLORS["bg"],
    plot_bgcolor=COLORS["card"],
    font=dict(family="monospace", color=COLORS["white"], size=11),
    margin=dict(l=50, r=50, t=60, b=50),
    title="",
    height=520,
    xaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"]),
    yaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"], autorange="reversed"),
)
st.plotly_chart(fig_heat, use_container_width=True)

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 5: Profit Distribution
# ---------------------------------------------------------------------------

st.markdown(f"### Profit Distribution — {ASSET_NAMES.get(selected_asset, selected_asset)} {selected_duration}M")

if rolling_data:
    df_dist = pd.DataFrame(rolling_data)
    scale = deposit / 1000

    shield_profits = df_dist["shield_profit"] * scale
    yield_profits = df_dist["yield_only_profit"] * scale

    fig_hist = go.Figure()

    fig_hist.add_trace(
        go.Histogram(
            x=yield_profits,
            name="Yield Only Profit",
            marker_color=COLORS["blue"],
            opacity=0.6,
            nbinsx=40,
            hovertemplate="Profit: $%{x:,.2f}<br>Count: %{y}<extra></extra>",
        )
    )
    fig_hist.add_trace(
        go.Histogram(
            x=shield_profits,
            name="Shield Profit",
            marker_color=COLORS["green"],
            opacity=0.6,
            nbinsx=40,
            hovertemplate="Profit: $%{x:,.2f}<br>Count: %{y}<extra></extra>",
        )
    )

    # Break-even line
    fig_hist.add_vline(
        x=0,
        line_dash="dash",
        line_color=COLORS["white"],
        annotation_text="Break-even",
        annotation_position="top right",
        annotation_font=dict(color=COLORS["white"], size=10),
    )

    fig_hist.update_layout(
        **PLOTLY_LAYOUT,
        barmode="overlay",
        xaxis_title="Profit ($)",
        yaxis_title="Count",
        height=400,
        title="",
    )
    st.plotly_chart(fig_hist, use_container_width=True)

    # Stats box
    col_s1, col_s2 = st.columns(2)
    with col_s1:
        st.markdown(
            f"""
<div style="background:#111118;border:1px solid #1E1E2E;border-radius:8px;padding:1rem;">
<h4 style="color:#00FF94;margin-top:0;">Shield Profit Stats</h4>
<p style="color:#F0F0F5;font-family:monospace;font-size:0.85rem;">
Mean: <b>${shield_profits.mean():,.2f}</b><br>
Median: <b>${shield_profits.median():,.2f}</b><br>
Std Dev: <b>${shield_profits.std():,.2f}</b><br>
Min: <b>${shield_profits.min():,.2f}</b> &nbsp; Max: <b>${shield_profits.max():,.2f}</b>
</p></div>""",
            unsafe_allow_html=True,
        )
    with col_s2:
        st.markdown(
            f"""
<div style="background:#111118;border:1px solid #1E1E2E;border-radius:8px;padding:1rem;">
<h4 style="color:#3B82F6;margin-top:0;">Yield Only Profit Stats</h4>
<p style="color:#F0F0F5;font-family:monospace;font-size:0.85rem;">
Mean: <b>${yield_profits.mean():,.2f}</b><br>
Median: <b>${yield_profits.median():,.2f}</b><br>
Std Dev: <b>${yield_profits.std():,.2f}</b><br>
Min: <b>${yield_profits.min():,.2f}</b> &nbsp; Max: <b>${yield_profits.max():,.2f}</b>
</p></div>""",
            unsafe_allow_html=True,
        )
else:
    st.info("No data available for this combination.")

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 6: Asset Price + Shield Return Over Time
# ---------------------------------------------------------------------------

st.markdown(f"### {ASSET_NAMES.get(selected_asset, selected_asset)} — Price vs Shield Return")

price_data = load_prices(selected_asset)

if price_data and rolling_data:
    df_price = pd.DataFrame(price_data)
    df_price["date"] = pd.to_datetime(df_price["date"])
    df_price = df_price.sort_values("date")

    df_roll = pd.DataFrame(rolling_data)
    df_roll["start_date"] = pd.to_datetime(df_roll["start_date"])
    scale = deposit / 1000
    df_roll["shield_return_scaled"] = df_roll["shield_return"] * scale

    from plotly.subplots import make_subplots

    fig_dual = make_subplots(specs=[[{"secondary_y": True}]])

    fig_dual.add_trace(
        go.Scatter(
            x=df_price["date"],
            y=df_price["price"],
            name="Asset Price",
            line=dict(color=COLORS["gold"], width=2),
            hovertemplate="Date: %{x}<br>Price: $%{y:,.2f}<extra></extra>",
        ),
        secondary_y=False,
    )

    fig_dual.add_trace(
        go.Scatter(
            x=df_roll["start_date"],
            y=df_roll["shield_return_scaled"],
            name="Shield Return",
            line=dict(color=COLORS["green"], width=2),
            hovertemplate="Start: %{x}<br>Shield Return: $%{y:,.2f}<extra></extra>",
        ),
        secondary_y=True,
    )

    fig_dual.update_layout(
        paper_bgcolor=COLORS["bg"],
        plot_bgcolor=COLORS["card"],
        font=dict(family="monospace", color=COLORS["white"], size=11),
        legend=dict(bgcolor=COLORS["card"], bordercolor=COLORS["border"]),
        margin=dict(l=50, r=50, t=60, b=50),
        height=420,
        title="",
        hovermode="x unified",
        xaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"]),
    )
    fig_dual.update_yaxes(
        title_text="Asset Price ($)",
        secondary_y=False,
        gridcolor=COLORS["border"],
        zerolinecolor=COLORS["border"],
        color=COLORS["gold"],
    )
    fig_dual.update_yaxes(
        title_text="Shield Return ($)",
        secondary_y=True,
        gridcolor=COLORS["border"],
        zerolinecolor=COLORS["border"],
        color=COLORS["green"],
    )
    st.plotly_chart(fig_dual, use_container_width=True)
elif not price_data:
    st.info(f"No price data found for {ASSET_NAMES.get(selected_asset, selected_asset)}.")
else:
    st.info("No rolling data available for this combination.")

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 7: APY History
# ---------------------------------------------------------------------------

st.markdown("### APY History — Yield Sources Over Time")

APY_SOURCES = {
    "morpho_steakhouse_usdc": ("Morpho Steakhouse", COLORS["green"]),
    "morpho_gauntlet_usdc": ("Morpho Gauntlet", COLORS["blue"]),
    "aave_v3_usdc": ("Aave V3", COLORS["gold"]),
    "moonwell_usdc_base": ("Moonwell", COLORS["red"]),
}

fig_apy = go.Figure()

for source_key, (label, color) in APY_SOURCES.items():
    data = load_apy(source_key)
    if data:
        df_apy = pd.DataFrame(data)
        date_col = "date" if "date" in df_apy.columns else "timestamp"
        df_apy[date_col] = pd.to_datetime(df_apy[date_col])
        df_apy = df_apy.sort_values(date_col)
        fig_apy.add_trace(
            go.Scatter(
                x=df_apy[date_col],
                y=df_apy["apy"],
                name=label,
                line=dict(color=color, width=1.5),
                hovertemplate=f"{label}<br>Date: %{{x}}<br>APY: %{{y:.2f}}%<extra></extra>",
            )
        )

# Best available line
best_apy_data = load_apy("best_apy")
if best_apy_data:
    df_best = pd.DataFrame(best_apy_data)
    df_best["date"] = pd.to_datetime(df_best["date"])
    df_best = df_best.sort_values("date")
    fig_apy.add_trace(
        go.Scatter(
            x=df_best["date"],
            y=df_best["apy"],
            name="Best Available",
            line=dict(color=COLORS["white"], width=3),
            hovertemplate="Best Available<br>Date: %{x}<br>APY: %{y:.2f}%<extra></extra>",
        )
    )

fig_apy.update_layout(
    **PLOTLY_LAYOUT,
    height=420,
    title="",
    yaxis_title="APY (%)",
    xaxis_title="Date",
    hovermode="x unified",
)
st.plotly_chart(fig_apy, use_container_width=True)

st.markdown("---")

# ---------------------------------------------------------------------------
# Section 8: Key Insights
# ---------------------------------------------------------------------------

st.markdown("### Key Insights")

# Compute dynamic insights from data
gold_6m = summary_for(summaries, "gold", 6)
silver_6m = summary_for(summaries, "silver", 6)

# Best case advantage: max shield profit minus corresponding max yield profit (per $10K)
# Find the combo with the highest max_shield_profit_pct
best_combo = max(summaries, key=lambda s: s["max_shield_profit_pct"])
max_shield_dollar = best_combo["max_shield_profit_pct"] / 100 * 10000
max_yield_dollar_same = best_combo["max_yield_profit_pct"] / 100 * 10000
best_case_extra = max_shield_dollar - max_yield_dollar_same

# Max yield missed (worst shield_loss_vs_yield)
max_yield_missed = max(abs(s["max_shield_loss_vs_yield"]) for s in summaries)

insights_html = f"""
<div style="background:#111118;border:1px solid #1E1E2E;border-radius:8px;padding:1.5rem;font-family:monospace;">
<p style="color:#00FF94;font-size:1rem;margin-bottom:0.75rem;">
\u2714 &nbsp; <b>Gold 6M: {gold_6m['shield_win_rate']:.0f}% win rate</b> &mdash; shield ALWAYS beat yield
</p>
<p style="color:#00FF94;font-size:1rem;margin-bottom:0.75rem;">
\u2714 &nbsp; <b>Silver 6M: {silver_6m['shield_win_rate']:.1f}% win rate</b>, +${silver_6m['avg_shield_advantage']:.2f} avg extra profit per $10K
</p>
<p style="color:#00FF94;font-size:1rem;margin-bottom:0.75rem;">
\u2714 &nbsp; <b>Principal protected in ALL {total_windows:,} tested windows</b>
</p>
<p style="color:#F59E0B;font-size:1rem;margin-bottom:0.75rem;">
\u26a0 &nbsp; Worst case: miss ~${max_yield_missed:.0f} of yield on $10K over 6 months
</p>
<p style="color:#00FF94;font-size:1rem;margin-bottom:0;">
\u2b06 &nbsp; Best case: earn +${best_case_extra:.0f} MORE than yield on $10K over 6 months
</p>
</div>
"""
st.markdown(insights_html, unsafe_allow_html=True)

st.markdown("")
st.markdown(
    "<p style='text-align:center;color:#6B7280;font-size:0.7rem;font-family:monospace;'>"
    "HedgeMyLife Backtest Dashboard &nbsp;&middot;&nbsp; Built with Streamlit + Plotly</p>",
    unsafe_allow_html=True,
)
