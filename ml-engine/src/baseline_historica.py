"""Referencias de manejo y entorno para variables sin observación propia."""
import pandas as pd


def baseline_historica(referencia, provincia, zona, variedad, columnas, categoricas):
    sub_df = referencia
    if variedad:
        temp_df = sub_df[sub_df["variedad"].str.lower() == variedad.lower()]
        if not temp_df.empty:
            sub_df = temp_df

    temp_df = sub_df[sub_df["provincia"] == provincia]
    if not temp_df.empty:
        sub_df = temp_df
    else:
        temp_df = sub_df[sub_df["zona"] == zona]
        if not temp_df.empty:
            sub_df = temp_df

    if sub_df.empty:
        sub_df = referencia

    baseline = {}
    for col in columnas:
        if col in categoricas:
            modes = sub_df[col].mode()
            if not modes.empty:
                baseline[col] = str(modes.iloc[0])
            else:
                baseline[col] = str(referencia[col].mode().iloc[0])
        else:
            median_val = sub_df[col].median()
            if pd.isna(median_val):
                median_val = referencia[col].median()
            baseline[col] = float(median_val)
    return baseline
