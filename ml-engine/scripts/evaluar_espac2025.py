"""Compara XGBoost y referencias sobre ESPAC documentada, sin publicar ni modificar el modelo activo."""
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import platform
import sys
import time
import numpy as np
import pandas as pd
import sklearn
from sklearn.preprocessing import OneHotEncoder
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_absolute_error,mean_squared_error,r2_score
import xgboost as xgb

ML=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ML))
from src.espac_dataset import prepare,FEATURES,CATEGORICAL,ROOT


def median_weighted(values,weights):
    order=np.argsort(values); v=np.asarray(values)[order]; w=np.asarray(weights)[order]
    return float(v[np.searchsorted(np.cumsum(w),w.sum()/2)])


def metrics(y,p,weights):
    return {'n':len(y),'mae_t_ha':float(mean_absolute_error(y,p)),'rmse_t_ha':float(np.sqrt(mean_squared_error(y,p))),
            'r2':float(r2_score(y,p)),'mae_ponderado_t_ha':float(mean_absolute_error(y,p,sample_weight=weights)),
            'rmse_ponderado_t_ha':float(np.sqrt(mean_squared_error(y,p,sample_weight=weights)))}


def main():
    frame,quality=prepare(ROOT/'documentacion/fuentes-maiz/candidatos/maiz_espac2025_original.csv')
    run=ML/'experimentos'/('espac2025-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')); run.mkdir(parents=True)
    configs=[{'n_estimators':250,'max_depth':2,'learning_rate':.04,'min_child_weight':10,'reg_lambda':8},
             {'n_estimators':350,'max_depth':3,'learning_rate':.03,'min_child_weight':10,'reg_lambda':5}]
    params={'objective':'reg:squarederror','tree_method':'hist','n_jobs':2,'random_state':42,'subsample':.8,'colsample_bytree':.8}
    record={'estado':'en_ejecucion','publicacion':False,'calidad':quality,'configuraciones':configs,'parametros_comunes':params,
            'versiones':{'python':platform.python_version(),'sklearn':sklearn.__version__,'xgboost':xgb.__version__},'resultados':{},
            'limites':['Una edición de encuesta; sin validación fuera de 2025.','Sin nombres de variedades, química de suelo o clima de parcela enlazados.','Se excluyen áreas cosechadas nulas; no estima probabilidad de pérdida total.','Factores de expansión usados como pesos; no se estiman intervalos del diseño muestral.','El diccionario describe 115 variables y producción en toneladas; sus límites de año 25–26 no coinciden con códigos 24–25 observados. No se usa año como feature ni se inventan fechas.','Este contrato no es intercambiable con el modelo activo de 36 variables.']}
    log=run/'experimento.json'
    def save(): log.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    save(); started=time.monotonic()
    y=frame.rendimiento_t_ha; weights=frame.peso_encuesta
    try:
        for split_name,groups in [('segmento_muestral',frame.grupo_segmento),('provincia_no_vista',frame.provincia)]:
            output={str(i):np.zeros(len(frame)) for i in range(len(configs))}; baseline=np.zeros(len(frame)); folds=[]
            for fold,(train,test) in enumerate(GroupKFold(n_splits=4).split(frame,y,groups),1):
                assert set(groups.iloc[train]).isdisjoint(groups.iloc[test])
                encoder=OneHotEncoder(handle_unknown='ignore',sparse_output=False)
                a=np.column_stack([encoder.fit_transform(frame.iloc[train][CATEGORICAL]),frame.iloc[train][FEATURES[3:]].to_numpy()])
                b=np.column_stack([encoder.transform(frame.iloc[test][CATEGORICAL]),frame.iloc[test][FEATURES[3:]].to_numpy()])
                for i,config in enumerate(configs):
                    model=xgb.XGBRegressor(**params,**config)
                    model.fit(a,y.iloc[train],sample_weight=(weights.iloc[train]/weights.iloc[train].mean()).to_numpy())
                    output[str(i)][test]=model.predict(b)
                for crop in frame.tipo_maiz.unique():
                    reference=train[frame.tipo_maiz.iloc[train].to_numpy()==crop]
                    if not len(reference): reference=train
                    mask=test[frame.tipo_maiz.iloc[test].to_numpy()==crop]
                    baseline[mask]=median_weighted(y.iloc[reference],weights.iloc[reference])
                folds.append({'fold':fold,'n_train':len(train),'n_test':len(test),'grupos_solapados':0})
                print(split_name,'pliegue',fold,'/4',flush=True)
            record['resultados'][split_name]={'referencia_mediana_por_tipo':metrics(y,baseline,weights),'xgboost':{key:metrics(y,p,weights) for key,p in output.items()},'pliegues':folds,
                'por_tipo':{crop:{'n':int(frame.tipo_maiz.eq(crop).sum()),'referencia':metrics(y[frame.tipo_maiz.eq(crop)],baseline[frame.tipo_maiz.eq(crop)],weights[frame.tipo_maiz.eq(crop)])} for crop in sorted(frame.tipo_maiz.unique())}}
            predictions=frame[['linea_copia_maiz','grupo_segmento','provincia','tipo_maiz','rendimiento_t_ha','peso_encuesta']].copy()
            predictions['referencia_t_ha']=baseline
            for key,values in output.items(): predictions['xgboost_'+key+'_t_ha']=values
            artifact=run/('predicciones_'+split_name+'.csv')
            predictions.to_csv(artifact,index=False)
            record['resultados'][split_name]['predicciones']={'archivo':artifact.name,'sha256':hashlib.sha256(artifact.read_bytes()).hexdigest()}
            save()
        record.update(estado='completado',segundos=round(time.monotonic()-started,3),decision='No publicar: contrato distinto, una sola edición y falta validación externa compatible.')
        save(); print(log,flush=True)
    except Exception as error:
        record.update(estado='fallido',error=str(error)); save(); raise


if __name__=='__main__': main()
