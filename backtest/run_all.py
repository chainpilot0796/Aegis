"""
Run the complete HedgeMyLife backtest pipeline.
Usage: python run_all.py
"""
import os
import subprocess
import sys


def run(script):
    print(f"\n{'='*60}")
    print(f"Running: {script}")
    print('='*60)
    result = subprocess.run([sys.executable, script], cwd=os.path.dirname(os.path.abspath(__file__)))
    if result.returncode != 0:
        print(f"ERROR: {script} failed with code {result.returncode}")
        sys.exit(1)
    print(f"[OK] {script} completed")


if __name__ == '__main__':
    os.makedirs('data/apy', exist_ok=True)
    os.makedirs('data/prices', exist_ok=True)
    os.makedirs('results/json', exist_ok=True)
    os.makedirs('results/charts', exist_ok=True)

    run('fetch_apy.py')
    run('fetch_prices.py')
    run('backtest.py')
    run('generate_charts.py')

    print("\n" + "="*60)
    print("BACKTEST COMPLETE")
    print("="*60)
    print("Results: results/json/")
    print("Charts:  results/charts/")
