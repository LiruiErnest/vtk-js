import vtkFullScreenRenderWindow  from '../../../../../Sources/Rendering/Misc/FullScreenRenderWindow';

import vtkActor                   from '../../../../../Sources/Rendering/Core/Actor';
import vtkCalculator              from '../../../../../Sources/Filters/General/Calculator';
import vtkDataArray               from '../../../../../Sources/Common/Core/DataArray';
import vtkMapper                  from '../../../../../Sources/Rendering/Core/Mapper';
import vtkPlaneSource             from '../../../../../Sources/Filters/Sources/PlaneSource';
import vtkPoints                  from '../../../../../Sources/Common/Core/Points';
import vtkPolyData                from '../../../../../Sources/Common/DataModel/PolyData';
import vtkWarpScalar              from '../../../../../Sources/Filters/General/WarpScalar';
import { ColorMode, ScalarMode }  from '../../../../../Sources/Rendering/Core/Mapper/Constants';
import { FieldDataTypes }         from '../../../../../Sources/Common/DataModel/DataSet/Constants';

import controlPanel from './controlPanel.html';

let formulaIdx = 0;
const FORMULA = [
  '((x[0] - 0.5) * (x[0] - 0.5)) + ((x[1] - 0.5) * (x[1] - 0.5)) + 0.125',
  '0.25 * Math.sin(Math.sqrt(((x[0] - 0.5) * (x[0] - 0.5)) + ((x[1] - 0.5) * (x[1] - 0.5)))*50)',
];

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({ background: [0.9, 0.9, 0.9] });
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------

const planeSource = vtkPlaneSource.newInstance({ xResolution: 25, yResolution: 25 });
const planeMapper = vtkMapper.newInstance({ colorMode: ColorMode.DEFAULT, scalarMode: ScalarMode.DEFAULT });
const planeActor = vtkActor.newInstance();
planeActor.getProperty().setEdgeVisibility(true);

const simpleFilter = vtkCalculator.newInstance();
simpleFilter.setFormulaSimple(
  FieldDataTypes.POINT, // Generate an output array defined over points.
  [],  // We don't request any point-data arrays because point coordinates are made available by default.
  'z', // Name the output array "z"
  x => ((x[0] - 0.5) * (x[0] - 0.5)) + ((x[1] - 0.5) * (x[1] - 0.5)) + 0.125
); // Our formula for z

const warpScalar = vtkWarpScalar.newInstance();
const warpMapper = vtkMapper.newInstance();
const warpActor = vtkActor.newInstance();

// The generated 'z' array will become the default scalars, so the plane mapper will color by 'z':
simpleFilter.setInputConnection(planeSource.getOutputPort());

// We will also generate a surface whose points are displaced from the plane by 'z':
warpScalar.setInputConnection(simpleFilter.getOutputPort());
warpScalar.setInputArrayToProcess(0, 'z', 'PointData', 'Scalars');

planeMapper.setInputConnection(simpleFilter.getOutputPort());
planeActor.setMapper(planeMapper);

warpMapper.setInputConnection(warpScalar.getOutputPort());
warpActor.setMapper(warpMapper);

renderer.addActor(planeActor);
renderer.addActor(warpActor);

renderer.resetCamera();
renderWindow.render();

// ----------------------------------------------------------------------------
// UI control handling
// ----------------------------------------------------------------------------

fullScreenRenderer.addController(controlPanel);

function applyFormula() {
  const el = document.querySelector('.formula');
  let fn = null;
  try {
    /* eslint-disable no-new-func */
    fn = new Function('x,y', `return ${el.value}`);
    /* eslint-enable no-new-func */
  } catch (exc) {
    if (!('name' in exc && exc.name === 'SyntaxError')) {
      console.log('Unexpected exception ', exc);
      el.style.background = '#fbb';
      return;
    }
  }
  if (fn) {
    el.style.background = '#fff';
    const formulaObj = simpleFilter.createSimpleFormulaObject(
      FieldDataTypes.POINT, [], 'z', fn);

    // See if the formula is actually valid by invoking "formulaObj" on
    // a dataset containing a single point.
    planeSource.update();
    const arraySpec = formulaObj.getArrays(planeSource.getOutputData());
    const testData = vtkPolyData.newInstance();
    const testPts = vtkPoints.newInstance();
    testPts.setData(
      vtkDataArray.newInstance({ name: 'coords', numberOfComponents: 3, size: 3, values: [0, 0, 0] }));
    testData.setPoints(testPts);
    const testOut = vtkPolyData.newInstance();
    testOut.shallowCopy(testData);
    const testArrays = simpleFilter.prepareArrays(arraySpec, testData, testOut);
    try {
      formulaObj.evaluate(testArrays.arraysIn, testArrays.arraysOut);

      // We evaluated 1 point without exception... it's safe to update the
      // filter and re-render.
      simpleFilter.setFormula(formulaObj);
      renderWindow.render();
      return;
    } catch (exc) {
      console.log('Unexpected exception ', exc);
    }
  }
  el.style.background = '#ffb';
}

['xResolution', 'yResolution'].forEach((propertyName) => {
  document.querySelector(`.${propertyName}`).addEventListener('input', (e) => {
    const value = Number(e.target.value);
    planeSource.set({ [propertyName]: value });
    renderWindow.render();
  });
});

['scaleFactor'].forEach((propertyName) => {
  document.querySelector(`.${propertyName}`).addEventListener('input', (e) => {
    const value = Number(e.target.value);
    warpScalar.set({ [propertyName]: value });
    renderWindow.render();
  });
});

document.querySelector('.formula').addEventListener('input', applyFormula);

document.querySelector('.next').addEventListener('click', (e) => {
  formulaIdx = (formulaIdx + 1) % FORMULA.length;
  document.querySelector('.formula').value = FORMULA[formulaIdx];
  applyFormula();
  renderWindow.render();
});

// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------

global.planeSource = planeSource;
global.planeMapper = planeMapper;
global.planeActor = planeActor;
global.simpleFilter = simpleFilter;
global.warpMapper = warpMapper;
global.warpActor = warpActor;
global.renderer = renderer;
global.renderWindow = renderWindow;