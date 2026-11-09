<?php
declare(strict_types=1);
namespace ZeaSys\Dominios\Terreno\Aplicacion;

/** Clases USDA por fracciones; agrupación explícita a categorías del modelo. */
final class TexturaSuelo
{
    public static function clasificar(array $suelo): ?array
    {
        foreach (['clay','sand','silt'] as $key) if (!isset($suelo[$key]) || !is_numeric($suelo[$key]) || $suelo[$key]<0 || $suelo[$key]>100) return null;
        $sum=$suelo['clay']+$suelo['sand']+$suelo['silt'];
        if ($sum<=0 || abs($sum-100)>5) return null;
        $c=$suelo['clay']*100/$sum; $a=$suelo['sand']*100/$sum; $l=$suelo['silt']*100/$sum;
        if ($l+1.5*$c<15) [$label,$group]=['Arenosa','arenoso'];
        elseif ($l+2*$c<30) [$label,$group]=['Areno franca','arenoso'];
        elseif (($c>=7 && $c<20 && $a>52) || ($c<7 && $l<50)) [$label,$group]=['Franco arenosa','arenoso'];
        elseif ($c>=7 && $c<27 && $l>=28 && $l<50 && $a<=52) [$label,$group]=['Franca','franco_equilibrado'];
        elseif (($l>=50 && $c>=12 && $c<27) || ($l>=50 && $l<80 && $c<12)) [$label,$group]=['Franco limosa','franco'];
        elseif ($l>=80 && $c<12) [$label,$group]=['Limosa','franco'];
        elseif ($c>=20 && $c<35 && $l<28 && $a>45) [$label,$group]=['Franco arcillo arenosa','arcilloso'];
        elseif ($c>=27 && $c<40 && $a>20 && $a<=45) [$label,$group]=['Franco arcillosa','arcilloso'];
        elseif ($c>=27 && $c<40 && $a<=20) [$label,$group]=['Franco arcillo limosa','arcillo_limoso'];
        elseif ($c>=35 && $a>45) [$label,$group]=['Arcillo arenosa','arcilloso'];
        elseif ($c>=40 && $l>=40) [$label,$group]=['Arcillo limosa','arcillo_limoso'];
        elseif ($c>=40 && $a<=45 && $l<40) [$label,$group]=['Arcillosa','arcilloso'];
        else return null;
        return ['clase_estimada'=>$label,'tipo_modelo'=>$group,'metodo'=>'Triángulo textural USDA; fracciones de mapa normalizadas para clasificación',
            'fuente_clasificacion'=>'https://www.nrcs.usda.gov/sites/default/files/2022-09/SSM-ch3.pdf',
            'nota'=>'El modelo agrupa algunas clases. La estimación superficial de mapa no sustituye un análisis de suelo.'];
    }
}
